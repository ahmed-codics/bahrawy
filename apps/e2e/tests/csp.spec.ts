import { expect, test } from '@playwright/test';

const WEB = 'http://localhost:3002';

test('staff admin HTML responses carry a strict nonce-based CSP', async ({
  request,
}) => {
  const response = await request.get(`${WEB}/login`);
  expect(response.ok()).toBeTruthy();

  const csp = response.headers()['content-security-policy'];
  expect(csp).toBeTruthy();

  for (const directive of [
    "default-src 'self'",
    'script-src',
    'nonce-',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]) {
    expect(csp).toContain(directive);
  }

  // No wildcard sources.
  expect(csp).not.toContain('*');

  // Scripts must be nonce-based, never allowed via unsafe-inline.
  const scriptSrc = csp.split(';').find((part) => part.trim().startsWith('script-src'));
  expect(scriptSrc).toBeTruthy();
  expect(scriptSrc).not.toContain('unsafe-inline');

  // The nonce in the header must be reflected on inline scripts in the HTML.
  const nonce = /nonce-([A-Za-z0-9+/=]+)/.exec(csp)?.[1];
  expect(nonce).toBeTruthy();
  const html = await response.text();
  expect(html).toContain(`nonce="${nonce}"`);
});