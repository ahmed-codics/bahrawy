export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

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

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

type ApiRequestOptions = RequestInit & { timeoutMs?: number };

// The admin API is being migrated route-by-route to explicit response types.
// Keep legacy callers working without leaking `any` into newly typed modules.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchApi<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const { timeoutMs = 12_000, ...requestOptions } = options;

  const isUnsafe = !['GET', 'HEAD', 'OPTIONS'].includes(
    (requestOptions.method || 'GET').toUpperCase(),
  );
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

  const execute = async (extraHeaders: Record<string, string>): Promise<Response> => {
    const headers = new Headers(requestOptions.headers || {});
    if (!headers.has('Content-Type') && !(requestOptions.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    for (const [k, v] of Object.entries(extraHeaders)) {
      headers.set(k, v);
    }
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(requestOptions.signal?.reason);
    if (requestOptions.signal?.aborted) abortFromCaller();
    else requestOptions.signal?.addEventListener('abort', abortFromCaller, { once: true });

    const timeout = globalThis.setTimeout(() => controller.abort('timeout'), timeoutMs);
    try {
      return await fetch(url, {
        cache: 'no-store',
        ...requestOptions,
        headers,
        credentials: 'include',
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted && !requestOptions.signal?.aborted) {
        throw new ApiRequestError(
          'انتهت مهلة الاتصال بالخادم. تأكد أن الـ API يعمل ثم حاول مجددًا.',
        );
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeout);
      requestOptions.signal?.removeEventListener('abort', abortFromCaller);
    }
  };

  let response = await execute({});

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
      /* ignore */
    }

    if (recover) {
      await refreshCsrfToken();
      if (csrfToken) {
        response = await execute({});
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
    throw new ApiRequestError(errorMsg, response.status);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null as T;
  }

  return response.json() as Promise<T>;
}
