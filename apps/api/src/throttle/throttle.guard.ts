import {
  Injectable,
  Optional,
  Inject,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import {
  THROTTLE_OPTIONS,
  SKIP_THROTTLE,
  ThrottleOptions,
} from './throttle.decorator';
import { getSessionTokenFromCookies } from '../auth/session-cookie';

export const GLOBAL_THROTTLE_CONFIG = 'GLOBAL_THROTTLE_CONFIG';

export interface GlobalThrottleConfig {
  /** Default request allowance applied to every route unless overridden. */
  limit?: number;
  /** Default time window for the global allowance. */
  windowMs?: number;
  /** Injectable clock solely to make tests deterministic (defaults to Date.now). */
  clock?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

// Global default applied to all API routes. Generous enough for normal student
// usage while still preventing request flooding / brute-force loops.
const DEFAULT_LIMIT = 200;
const DEFAULT_WINDOW_MS = 60_000;

const CLEANUP_INTERVAL_MS = 60_000;

// Health/liveness/probe endpoints monitoring poll frequently; never throttle.
const EXEMPT_PATHS = new Set([
  '/health',
  '/healthz',
  '/readiness',
  '/liveness',
]);

// Non-mutating preflight/server checks are never throttled.
const EXEMPT_METHODS = new Set(['OPTIONS', 'HEAD']);

@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private lastCleanup = Date.now();

  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(GLOBAL_THROTTLE_CONFIG)
    private readonly config: GlobalThrottleConfig = {},
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method: string = request?.method || 'GET';
    if (EXEMPT_METHODS.has(method)) return true;

    const path: string = (request?.originalUrl || request?.url || '').split(
      '?',
    )[0];
    if (EXEMPT_PATHS.has(path)) return true;

    const handler = context.getHandler();
    if (this.reflector.get<boolean>(SKIP_THROTTLE, handler)) return true;

    const options = this.reflector.get<ThrottleOptions>(
      THROTTLE_OPTIONS,
      handler,
    );

    const identity = this.identityKey(request);
    const now = (this.config.clock ?? Date.now)();

    const response = context.switchToHttp().getResponse();

    // 1) Global layer: every route counts toward a per-identity budget.
    const globalLimit = this.config.limit ?? DEFAULT_LIMIT;
    const globalWindow = this.config.windowMs ?? DEFAULT_WINDOW_MS;
    const global = this.consume(
      `g:${identity}`,
      globalLimit,
      globalWindow,
      now,
    );
    this.settleRateLimitHeaders(
      response,
      globalLimit,
      global.remaining,
      global.resetAt,
      now,
    );
    if (global.exceeded) {
      this.throwTooManyRequests();
      return false;
    }

    // 2) Route-specific layer: tighter budgets (e.g. authentication) preserved.
    if (options) {
      const route = request.route?.path || request.url || path;
      const routeKey = `r:${route}:${identity}`;
      const bucketed = this.consume(
        routeKey,
        options.limit,
        options.windowMs,
        now,
      );
      this.settleRateLimitHeaders(
        response,
        options.limit,
        bucketed.remaining,
        bucketed.resetAt,
        now,
      );
      if (bucketed.exceeded) {
        this.throwTooManyRequests();
        return false;
      }
    }

    return true;
  }

  private identityKey(request: any): string {
    // Authenticated requests are keyed by their session token (hashed), so a
    // user cannot dodge their own budget by changing IP or arbitrary fields.
    // Unauthenticated requests are keyed by the trusted proxy-derived IP.
    const token = getSessionTokenFromCookies(request);
    if (token) {
      const digest = createHash('sha256')
        .update(token)
        .digest('hex')
        .slice(0, 32);
      return `session:${digest}`;
    }
    const ip = request?.ip || request?.socket?.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  private consume(
    key: string,
    limit: number,
    windowMs: number,
    now: number,
  ): { exceeded: boolean; remaining: number; resetAt: number } {
    this.cleanup(now);
    let bucket = this.buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
      return { exceeded: false, remaining: limit - 1, resetAt: bucket.resetAt };
    }
    bucket.count++;
    return {
      exceeded: bucket.count > limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  private cleanup(now: number) {
    if (now - this.lastCleanup < CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;
    for (const [key, bucket] of this.buckets) {
      if (now > bucket.resetAt) this.buckets.delete(key);
    }
  }

  private settleRateLimitHeaders(
    response: any,
    limit: number,
    remaining: number,
    resetAt: number,
    now: number,
  ) {
    if (!response || typeof response.setHeader !== 'function') return;
    try {
      response.setHeader('X-RateLimit-Limit', String(limit));
      response.setHeader(
        'X-RateLimit-Remaining',
        String(Math.max(0, remaining)),
      );
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((resetAt - now) / 1000))),
      );
    } catch {
      // Headers may be immutable after flush; ignore.
    }
  }

  private throwTooManyRequests(): never {
    throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }
}
