import { SetMetadata } from '@nestjs/common';

export const THROTTLE_OPTIONS = 'THROTTLE_OPTIONS';

export interface ThrottleOptions {
  limit: number;
  windowMs: number;
}

export const Throttle = (limit: number, windowMs: number) =>
  SetMetadata(THROTTLE_OPTIONS, { limit, windowMs });
