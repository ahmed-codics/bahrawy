import express, { type Express } from 'express';
import request from 'supertest';
import {
  CSP_DIRECTIVES,
  applyHttpSecurity,
  buildHttpSecurityOptions,
} from './http-security';

function makeApp(production: boolean): Express {
  const app = express();
  applyHttpSecurity(app, production);
  app.get('/', (_req, res) => res.send('Hello World!'));
  return app;
}

function expectNoWildcardDirective(csp: string): void {
  for (const directive of Object.keys(CSP_DIRECTIVES)) {
    const match = csp.match(new RegExp(`${directive} ([^;]+);`, 'i'));
    if (!match) continue;
    expect(match[1].trim()).not.toBe('*');
  }
}

describe('buildHttpSecurityOptions', () => {
  it('disables COEP and deliberately leaks CORP to support cross-origin media', () => {
    const opts = buildHttpSecurityOptions(false);
    expect(opts.crossOriginEmbedderPolicy).toBe(false);
    expect(opts.crossOriginResourcePolicy).toEqual({
      policy: 'cross-origin',
    });
  });

  it('sets CSP directives that contain no wildcard source', () => {
    const csp = buildHttpSecurityOptions(false);
    const directives = csp.contentSecurityPolicy as {
      useDefaults: false;
      directives: Record<string, readonly string[]>;
    };
    for (const sources of Object.values(directives.directives)) {
      for (const src of sources) {
        expect(src).not.toBe('*');
      }
    }
  });

  it('disables HSTS when not in production (development over HTTP)', () => {
    expect(buildHttpSecurityOptions(false).hsts).toBe(false);
  });

  it('enables HSTS without preload in production', () => {
    const opts = buildHttpSecurityOptions(true);
    expect(opts.hsts).toEqual({
      maxAge: 15_552_000,
      includeSubDomains: true,
      preload: false,
    });
  });
});

describe('security headers (dev/non-production)', () => {
  const app = makeApp(false);

  it('does not expose X-Powered-By', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('sends X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('denies framing via X-Frame-Options', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('sends a Referrer-Policy', async () => {
    const res = await request(app).get('/');
    expect(res.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('sends a Content-Security-Policy with no wildcard directive', async () => {
    const res = await request(app).get('/');
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expectNoWildcardDirective(csp);
  });

  it('does not send Strict-Transport-Security in development', async () => {
    const res = await request(app).get('/');
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });
});

describe('security headers (production)', () => {
  const app = makeApp(true);

  it('sends Strict-Transport-Security without preload', async () => {
    const res = await request(app).get('/');
    const hsts = res.headers['strict-transport-security'];
    expect(hsts).toContain('max-age=15552000');
    expect(hsts).not.toContain('preload');
  });
});
