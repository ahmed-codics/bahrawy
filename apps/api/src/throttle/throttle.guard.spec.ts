import { ThrottleGuard } from './throttle.guard';
import { THROTTLE_OPTIONS, SKIP_THROTTLE } from './throttle.decorator';
import { Reflector } from '@nestjs/core';
import { HttpException, HttpStatus } from '@nestjs/common';

function makeHandler(metadata?: { key: string; value: unknown }) {
  const handler = () => undefined;
  if (metadata) {
    Reflect.defineMetadata(metadata.key, metadata.value, handler);
  }
  return handler;
}

function makeContext(opts: {
  method?: string;
  url?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  ip?: string;
  handler?: () => void;
}) {
  const headers = { ...(opts.headers ?? {}) };
  const request = {
    method: opts.method ?? 'GET',
    url: opts.url ?? '/catalog/products',
    originalUrl: opts.url ?? '/catalog/products',
    route: { path: opts.url ?? '/catalog/products' },
    ip: opts.ip ?? '10.0.0.1',
    socket: { remoteAddress: '10.0.0.1' },
    headers,
    cookies: opts.cookies ?? {},
    signedCookies: {},
  };
  const responseHeaders: Record<string, string> = {};
  const response = {
    setHeader: (k: string, v: string) => {
      responseHeaders[k] = v;
    },
    _headers: responseHeaders,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => opts.handler ?? makeHandler(),
    responseHeaders,
  };
}

describe('ThrottleGuard (global rate limiting)', () => {
  // Test-scoped config: tiny global budget + deterministic clock so the suite
  // never depends on real waiting.
  const clock = { now: 1_000_000 };
  const nowFn = () => clock.now;

  const buildGuard = (config?: { limit?: number; windowMs?: number }) =>
    new ThrottleGuard(new Reflector(), {
      limit: config?.limit ?? 3,
      windowMs: config?.windowMs ?? 60_000,
      clock: nowFn,
    });

  const expect429 = (fn: () => boolean) => {
    try {
      fn();
      return null;
    } catch (err) {
      if (err instanceof HttpException) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        const response = err.getResponse() as any;
        const message =
          typeof response === 'string' ? response : response?.message;
        expect(message).toBe('Too many requests');
        return err;
      }
      throw err;
    }
  };

  afterEach(() => {
    clock.now += 60_000;
  });

  it('allows normal traffic within the global budget', () => {
    const guard = buildGuard();
    const ctx = makeContext({});
    for (let i = 0; i < 3; i++) {
      expect(guard.canActivate(ctx as any)).toBe(true);
    }
  });

  it('returns 429 when the global limit is exceeded', () => {
    const guard = buildGuard();
    const ctx = makeContext({});
    for (let i = 0; i < 3; i++) guard.canActivate(ctx as any);
    const error = expect429(() => guard.canActivate(ctx as any));
    expect(error).not.toBeNull();
  });

  it('applies to an unprotected public endpoint with no @Throttle decorator', () => {
    const guard = buildGuard();
    const ctx = makeContext({ url: '/catalog/products' });
    for (let i = 0; i < 3; i++) guard.canActivate(ctx as any);
    expect429(() => guard.canActivate(ctx as any));
  });

  it('does not throttle health/probe endpoints', () => {
    const guard = buildGuard();
    for (const path of ['/health', '/healthz', '/readiness', '/liveness']) {
      const ctx = makeContext({ url: path });
      for (let i = 0; i < 50; i++) {
        expect(guard.canActivate(ctx as any)).toBe(true);
      }
    }
  });

  it('does not throttle OPTIONS/HEAD preflight requests', () => {
    const guard = buildGuard();
    const ctx = makeContext({ method: 'OPTIONS' });
    for (let i = 0; i < 50; i++) {
      expect(guard.canActivate(ctx as any)).toBe(true);
    }
  });

  it('keys authenticated requests by session token so IP changes cannot bypass', () => {
    const guard = buildGuard();
    const cookies = { bahrawy_session_student: 'token-abc' };
    // First attempt from one IP.
    const ctxA = makeContext({ cookies, ip: '10.0.0.1', headers: {} });
    const ctxB = makeContext({ cookies, ip: '203.0.113.9', headers: {} });
    for (let i = 0; i < 3; i++) guard.canActivate(ctxA as any);
    // A different IP with the SAME session token is still within the same bucket.
    expect429(() => guard.canActivate(ctxB as any));
  });

  it('gives a fresh budget to a different session token', () => {
    const guard = buildGuard();
    for (let i = 0; i < 3; i++) {
      expect(
        guard.canActivate(
          makeContext({
            cookies: { bahrawy_session_student: `tok-${i}` },
            headers: {},
          }) as any,
        ),
      ).toBe(true);
    }
  });

  it('preserves stricter per-route limits from @Throttle metadata', () => {
    // Global allows 3, route allows 2 -> the 3rd request is blocked.
    const guard = buildGuard();
    const handler = makeHandler({
      key: THROTTLE_OPTIONS,
      value: { limit: 2, windowMs: 60_000 },
    });
    const ctx = makeContext({ url: '/auth/login', handler });
    guard.canActivate(ctx as any);
    guard.canActivate(ctx as any);
    expect429(() => guard.canActivate(ctx as any));
  });

  it('honors @SkipThrottle for documented bypasses', () => {
    const guard = buildGuard();
    const handler = makeHandler({ key: SKIP_THROTTLE, value: true });
    const ctx = makeContext({ handler });
    for (let i = 0; i < 20; i++) {
      expect(guard.canActivate(ctx as any)).toBe(true);
    }
  });

  it('sets Retry-After and X-RateLimit headers on 429 responses', () => {
    const guard = buildGuard();
    const ctx = makeContext({});
    for (let i = 0; i < 3; i++) guard.canActivate(ctx as any);
    try {
      guard.canActivate(ctx as any);
    } catch {
      /* expected */
    }
    expect(Number(ctx.responseHeaders['Retry-After'])).toBeGreaterThanOrEqual(
      1,
    );
    expect(ctx.responseHeaders['X-RateLimit-Limit']).toBe('3');
    expect(ctx.responseHeaders['X-RateLimit-Remaining']).toBe('0');
  });
});
