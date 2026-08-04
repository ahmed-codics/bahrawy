import * as dotenv from 'dotenv';
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('Config Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should validate valid environment variables', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.VALKEY_URL = 'redis://localhost:6379';
    process.env.COOKIE_SECRET = 'b'.repeat(32);
    process.env.ENCRYPTION_KEY = 'c'.repeat(64);
    process.env.HMAC_KEY = 'd'.repeat(32);
    process.env.CLOUDFLARE_ACCESS_AUDIENCE = 'audience';
    process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN = 'test.cloudflareaccess.com';
    process.env.TURNSTILE_SECRET_KEY = 'secret';

    const { validateEnv } = require('./index');
    expect(() => validateEnv()).not.toThrow();
  });

  it('should throw error for missing required variables', () => {
    delete process.env.DATABASE_URL;
    expect(() => {
      require('./index');
    }).toThrow('Invalid environment variables');
  });

  it('should throw error for malformed variables', () => {
    process.env.DATABASE_URL = 'not-a-url';
    expect(() => {
      require('./index');
    }).toThrow('Invalid environment variables');
  });
});
