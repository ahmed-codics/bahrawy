import { SetMetadata } from '@nestjs/common';

export const THROTTLE_OPTIONS = 'THROTTLE_OPTIONS';
export const SKIP_THROTTLE = 'SKIP_THROTTLE';

export interface ThrottleOptions {
  limit: number;
  windowMs: number;
}

export const Throttle = (limit: number, windowMs: number) =>
  SetMetadata(THROTTLE_OPTIONS, { limit, windowMs });

/**
 * Opts a single route out of rate limiting. Only use where there is a
 * documented reason (e.g. cheap health/liveness checks that monitoring hits
 * frequently).
 */
export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE, true);
