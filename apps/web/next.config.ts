import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  transpilePackages: ['@smartshaadi/types', '@smartshaadi/schemas'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'http',  hostname: '127.0.0.1' },
    ],
  },
};

// Sentry: wraps the build with source-map upload + auto-instrumentation.
// No-op at runtime when SENTRY_DSN unset. Source-map upload only runs when
// SENTRY_AUTH_TOKEN is set at build time (silent otherwise).
export default withSentryConfig(nextConfig, {
  silent:                !process.env['CI'],
  org:                   process.env['SENTRY_ORG'],
  project:               process.env['SENTRY_PROJECT'],
  authToken:             process.env['SENTRY_AUTH_TOKEN'],
  widenClientFileUpload: true,
  disableLogger:         true,
});
