export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const DEVICE_FINGERPRINT_KEY = 'bahrawy-device-fingerprint';

function getDeviceFingerprint() {
  if (typeof window === 'undefined') return null;

  const existing = window.localStorage.getItem(DEVICE_FINGERPRINT_KEY);
  if (existing) return existing;

  const fingerprint =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(DEVICE_FINGERPRINT_KEY, fingerprint);
  return fingerprint;
}

let csrfToken: string | null = null;
let csrfTokenPromise: Promise<void> | null = null;
let csrfTokenGen = 0;
const setCsrfToken = (token: string | null, capturedGen: number) => {
  if (csrfTokenGen !== capturedGen) return;
  csrfToken = token;
};

export function clearCsrfToken() {
  csrfToken = null;
  csrfTokenGen++;
}

export async function fetchCsrfToken() {
  if (csrfTokenPromise) return csrfTokenPromise;
  const capturedGen = csrfTokenGen;
  csrfTokenPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/csrf-token`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.csrfToken) setCsrfToken(data.csrfToken, capturedGen);
    } catch {
      // Not logged in — CSRF token not available
    }
  })();
  try {
    await csrfTokenPromise;
  } finally {
    csrfTokenPromise = null;
  }
}

export async function refreshCsrfToken() {
  if (csrfTokenPromise) await csrfTokenPromise;
  clearCsrfToken();
  await fetchCsrfToken();
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`;

  const isUnsafe = !['GET', 'HEAD', 'OPTIONS'].includes((options.method || 'GET').toUpperCase());
  const isCsrfExempt = new Set([
    '/auth/login',
    '/auth/staff-login',
    '/auth/register',
    '/auth/activate',
    '/auth/check-phone',
    '/auth/staff/recovery-consume',
  ]).has(endpoint.split('?')[0]);

  if (isUnsafe && !isCsrfExempt && !csrfToken) {
    await fetchCsrfToken();
  }

  const execute = async (): Promise<Response> => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('X-Device-Fingerprint')) {
      const fingerprint = getDeviceFingerprint();
      if (fingerprint) headers.set('X-Device-Fingerprint', fingerprint);
    }
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }

    return await fetch(url, {
      cache: 'no-store',
      ...options,
      headers,
      credentials: 'include',
    });
  };

  let response = await execute();

  if (isUnsafe && response.status === 403) {
    let recover = false;
    try {
      const body = await response.clone().json();
      const message =
        typeof body.message === 'string'
          ? body.message
          : typeof body.message?.message === 'string'
            ? body.message.message
            : '';
      recover = message === 'Missing CSRF token' || message === 'Invalid CSRF token';
    } catch {
      // ignore
    }

    if (recover) {
      await refreshCsrfToken();
      if (csrfToken) {
        response = await execute();
      }
    }
  }

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const errData = await response.json();
      const message = errData.message;
      errorMsg =
        typeof message === 'string'
          ? message
          : Array.isArray(message)
            ? message.join('، ')
            : typeof message?.message === 'string'
              ? message.message
              : Array.isArray(message?.message)
                ? message.message.join('، ')
                : errorMsg;
    } catch {
      // Ignore
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  return response.json();
}
