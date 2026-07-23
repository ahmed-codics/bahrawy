import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

function findEnvFile(dir: string): string | null {
  const envPath = path.join(dir, '.env');
  if (fs.existsSync(envPath)) return envPath;
  const parent = path.dirname(dir);
  if (parent === dir) return null;
  return findEnvFile(parent);
}

const envPath = findEnvFile(process.cwd()) || findEnvFile(__dirname);
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  API_ORIGIN: z.string().url().default('http://localhost:3000'),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().url(),
  VALKEY_URL: z.string().url(),
  COOKIE_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hex characters'),
  HMAC_KEY: z.string().min(32),
  VIDEO_SIGNING_SECRET: z.string().min(32).default('dummy_video_signing_secret_for_dev_32_chars'),
  HLS_STORAGE_PATH: z.string().default('/mnt/hls'),
  UPLOAD_STORAGE_PATH: z.string().default('/mnt/uploads'),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('bahrawy-videos'),
  R2_ENDPOINT: z.string().url().optional(),
  R2_REGION: z.string().default('auto'),
  CLAMAV_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  CLAMAV_HOST: z.string().default('localhost'),
  CLAMAV_PORT: z.string().default('3310'),
  PROXY_TRUST: z.string().default('loopback'),
  CLOUDFLARE_ACCESS_AUDIENCE: z.string(),
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: z.string(),
  TURNSTILE_SECRET_KEY: z.string(),
});

export function validateEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '❌ FATAL: Missing or invalid environment variables in production:',
        parsed.error.flatten().fieldErrors,
      );
      process.exit(1);
    } else {
      console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
      throw new Error('Invalid environment variables');
    }
  }
  return parsed.data;
}

export const env = validateEnv();
