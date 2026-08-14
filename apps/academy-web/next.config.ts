import type { NextConfig } from 'next';
import path from 'node:path';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [];
if (apiUrl?.startsWith('http')) {
  const parsed = new URL(apiUrl);
  remotePatterns.push({
    protocol: parsed.protocol.replace(':', '') as 'http' | 'https',
    hostname: parsed.hostname,
    port: parsed.port,
    pathname: '/**',
  });
}

const apiHost = apiUrl ? new URL(apiUrl).host : 'localhost:3000';

// 'unsafe-inline' is required by Next.js for its inline hydration/bootstrap
// scripts. 'unsafe-eval' is only needed by webpack HMR in development and is
// deliberately excluded from production CSP.
const isDev = process.env.NODE_ENV !== 'production';
const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://s.ytimg.com',
];

const cspDirectives = [
  "default-src 'self'",
  `connect-src 'self' ${apiHost}${isDev ? ' ws: wss:' : ''}`,
  `script-src ${scriptSources.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://www.youtube.com https://www.youtube-nocookie.com",
  "media-src 'self' blob: data:",
  "font-src 'self' data:",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  experimental: {
    optimizePackageImports: ['@bahrawy/ui', 'lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspDirectives,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
