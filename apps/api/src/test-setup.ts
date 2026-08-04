process.env.DATABASE_URL =
  'postgresql://academy:academy_secret@localhost:5432/bahrawy_db';
process.env.VALKEY_URL = 'redis://localhost:6379';
process.env.COOKIE_SECRET =
  'local_development_cookie_secret_do_not_use_in_prod';
process.env.ENCRYPTION_KEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.HMAC_KEY = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
process.env.CLOUDFLARE_ACCESS_AUDIENCE = 'fake_local_audience';
process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN = 'test.cloudflareaccess.com';
process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
