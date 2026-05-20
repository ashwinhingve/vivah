import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@smartshaadi/types', '@smartshaadi/schemas'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: 'api.smartshaadi.co.in' },
      { protocol: 'https', hostname: '**.smartshaadi.co.in' },
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'http',  hostname: '127.0.0.1' },
    ],
  },
};

// Wrap with Sentry only when full upload trio is present.
// Avoids Vercel build failures when SENTRY_AUTH_TOKEN/ORG/PROJECT are unset
// (Sentry webpack plugin emits errors that can fail the recursive pnpm run).
// Runtime SDK init still happens via sentry.{client,server,edge}.config.ts
// when NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN are set.
const sentryEnabled =
  !!process.env['SENTRY_AUTH_TOKEN'] &&
  !!process.env['SENTRY_ORG'] &&
  !!process.env['SENTRY_PROJECT'];

const composedConfig = sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent:                !process.env['CI'],
      org:                   process.env['SENTRY_ORG'],
      project:               process.env['SENTRY_PROJECT'],
      authToken:             process.env['SENTRY_AUTH_TOKEN'],
      widenClientFileUpload: true,
      disableLogger:         true,
    })
  : nextConfig;

export default withNextIntl(composedConfig);
