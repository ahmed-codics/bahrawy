import { NextRequest, NextResponse } from 'next/server';

function apiCspOrigins(): string[] {
  const origins: string[] = ['http://localhost:3000'];
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) {
    try {
      const { protocol, host } = new URL(configured);
      if (protocol && host) {
        origins.push(`${protocol}//${host}`);
      }
    } catch {
      // Ignore malformed values rather than crashing every request.
    }
  }
  const r2Endpoint = process.env.R2_ENDPOINT;
  if (r2Endpoint) {
    try {
      const { protocol, host } = new URL(r2Endpoint);
      if (protocol && host) {
        origins.push(`${protocol}//${host}`);
        origins.push(`${protocol}//*.${host}`);
      }
    } catch {
      // Ignore malformed values
    }
  }
  return origins;
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const api = apiCspOrigins().join(' ');
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: ${api};
    font-src 'self' data:;
    connect-src 'self'${isDev ? ' ws: http: https:' : ` ${api}`};
    media-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${request.nextUrl.protocol === 'https:' ? 'upgrade-insecure-requests;' : ''}
  `;
  const contentSecurityPolicyHeaderValue = cspHeader
    .replace(/\s{2,}/g, ' ')
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue,
  );

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue,
  );

  return response;
}

export const config = {
  matcher: [
    {
      source:
        '/((?!api|_next/static|_next/image|_next/internal|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};