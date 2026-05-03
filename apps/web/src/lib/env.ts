import { z } from 'zod';

// Runs at module load on both server (Node) and client (browser bundle).
// Throws if a required public var is missing — a misconfigured Vercel deploy
// fails loudly instead of silently hitting localhost.

const ServerSchema = z.object({
  NEXT_PUBLIC_API_URL:    z.string().url().default('http://localhost:4000/api/v1'),
  NEXT_PUBLIC_SOCKET_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_APP_NAME:   z.string().min(1).default('Smart Shaadi'),
  NEXT_PUBLIC_POSTHOG_KEY:  z.string().default(''),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default('https://app.posthog.com'),
  NEXT_PUBLIC_SENTRY_DSN:   z.string().default(''),
});

const parsed = ServerSchema.safeParse({
  NEXT_PUBLIC_API_URL:      process.env['NEXT_PUBLIC_API_URL'],
  NEXT_PUBLIC_SOCKET_URL:   process.env['NEXT_PUBLIC_SOCKET_URL'],
  NEXT_PUBLIC_APP_NAME:     process.env['NEXT_PUBLIC_APP_NAME'],
  NEXT_PUBLIC_POSTHOG_KEY:  process.env['NEXT_PUBLIC_POSTHOG_KEY'],
  NEXT_PUBLIC_POSTHOG_HOST: process.env['NEXT_PUBLIC_POSTHOG_HOST'],
  NEXT_PUBLIC_SENTRY_DSN:   process.env['NEXT_PUBLIC_SENTRY_DSN'],
});

if (!parsed.success) {
  console.error('❌ Invalid web environment variables:', parsed.error.flatten());
  throw new Error('Invalid web env: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
}

const e = parsed.data;

// Server-side env (never exposed to browser unless re-exported as NEXT_PUBLIC_*)
export const serverEnv = {
  apiUrl: e.NEXT_PUBLIC_API_URL,
};

// Client-safe env (all NEXT_PUBLIC_*)
export const clientEnv = {
  apiUrl:      e.NEXT_PUBLIC_API_URL,
  socketUrl:   e.NEXT_PUBLIC_SOCKET_URL,
  appName:     e.NEXT_PUBLIC_APP_NAME,
  posthogKey:  e.NEXT_PUBLIC_POSTHOG_KEY,
  posthogHost: e.NEXT_PUBLIC_POSTHOG_HOST,
  sentryDsn:   e.NEXT_PUBLIC_SENTRY_DSN,
};
