// Validate env at build/start time so misconfiguration fails fast.
import './src/config/env';

import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/**
 * Where uploaded product images live (MEDIA_PUBLIC_BASE_URL of the API):
 * - `MEDIA_REMOTE_HOSTS`: CDN hosts next/image may optimise from, comma-separated (production).
 * - `MEDIA_BUCKET_URL`: development only — the public bucket (e.g. http://127.0.0.1:9000/as-media)
 *   that `/media/*` on this site proxies to, so uploads work with MEDIA_PUBLIC_BASE_URL pointing
 *   at the storefront itself.
 */
const mediaRemoteHosts = (process.env.MEDIA_REMOTE_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);
const mediaBucketUrl = process.env.MEDIA_BUCKET_URL?.replace(/\/+$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Payment screenshots are capped at 5 MB in validation; leave headroom for multipart overhead.
      bodySizeLimit: '6mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 90],
    remotePatterns: mediaRemoteHosts.map((hostname) => ({ protocol: 'https', hostname })),
  },
  async rewrites() {
    return mediaBucketUrl
      ? [{ source: '/media/:path*', destination: `${mediaBucketUrl}/media/:path*` }]
      : [];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
