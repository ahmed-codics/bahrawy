import helmet, { type HelmetOptions } from 'helmet';
import type { Express } from 'express';

export const CSP_DIRECTIVES = {
  defaultSrc: ["'none'"],
  scriptSrc: ["'none'"],
  styleSrc: ["'none'"],
  imgSrc: ["'none'"],
  fontSrc: ["'none'"],
  connectSrc: ["'none'"],
  mediaSrc: ["'none'"],
  objectSrc: ["'none'"],
  frameSrc: ["'none'"],
  frameAncestors: ["'none'"],
  workerSrc: ["'none'"],
  manifestSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
} satisfies Record<string, string[]>;

export function buildHttpSecurityOptions(production: boolean): HelmetOptions {
  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        ...CSP_DIRECTIVES,
        ...(production ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    // The API serves audited cross-origin media/images to two separate
    // frontend origins, so CORP must permit cross-origin embedding.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    // COEP "require-corp" would force CORP on shared same-origin resources
    // and break the credentialed cross-origin flows; disabled deliberately.
    crossOriginEmbedderPolicy: false,
    // HSTS only when the API is served exclusively over HTTPS (production).
    hsts: production
      ? { maxAge: 15_552_000, includeSubDomains: true, preload: false }
      : false,
    // Safe modern referrer policy; least likely to interfere with payment /
    // upload redirect flows while still withholding credentials on downgrade.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'deny' },
  };
}

export function applyHttpSecurity(app: Express, production: boolean): void {
  // Strip the framework banner; Helmet does not remove it by default.
  app.disable('x-powered-by');
  app.use(helmet(buildHttpSecurityOptions(production)));
}
