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

const nextConfig: NextConfig = {
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
};

export default nextConfig;
