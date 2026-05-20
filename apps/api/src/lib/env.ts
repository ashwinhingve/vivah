import { config } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Load root .env before validation.
// env.ts lives at apps/api/src/lib/ — root is 4 levels up.
config({ path: resolve(__dirname, '../../../../.env'), override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  MONGODB_URI:  z.string().default('mongodb://localhost:27017/smartshaadi'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // JWT_SECRET retained for backwards compatibility with test setups.
  // No production code path currently signs/verifies JWTs (Better Auth uses
  // database-backed sessions). Kept optional to avoid breaking test envs.
  JWT_SECRET: z.string().default(''),

  // Mock flag: set USE_MOCK_SERVICES=true in dev/test to skip real external calls.
  // Swap to real by removing this var (or setting to false) — no code change needed.
  USE_MOCK_SERVICES: z.string().default('false').transform(v => v === 'true'),

  // MongoDB live override: when 'true', connect to MongoDB even if USE_MOCK_SERVICES=true.
  // Lets us use real Mongo Atlas in production while keeping OTP/Razorpay/etc. mocked
  // until those provider registrations are completed.
  MONGO_LIVE: z.string().default('false').transform(v => v === 'true'),

  // R2 live override: when 'true', use real Cloudflare R2 even if USE_MOCK_SERVICES=true.
  // Lets us flip photos to real R2 in production without dropping the global mock flag.
  R2_LIVE: z.string().default('false').transform(v => v === 'true'),

  // Mock OTP override value — REQUIRED whenever USE_MOCK_SERVICES=true,
  // enforced by a superRefine below. No default (the old '123456' default
  // was a backdoor on any deployed mock-mode env). Use
  // `openssl rand -hex 4` to generate a fresh value per environment.
  MOCK_OTP_VALUE: z.string().optional(),

  MSG91_API_KEY:      z.string().default(''),
  MSG91_TEMPLATE_ID:  z.string().default(''),

  API_BASE_URL: z.string().url('API_BASE_URL must be a valid URL').default('http://localhost:4000'),
  WEB_URL: z.string().url('WEB_URL must be a valid URL').default('http://localhost:3000'),

  // Internal AI service (Python/FastAPI)
  AI_SERVICE_URL:          z.string().url().default('http://localhost:8000'),
  AI_SERVICE_INTERNAL_KEY: z.string().default('internal-key-change-in-prod'),

  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),

  // R2 credentials — only required in production (USE_MOCK_SERVICES=false).
  // In dev/test mode the upload paths short-circuit before these are used.
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().default(''),
  CLOUDFLARE_R2_ACCESS_KEY: z.string().default(''),
  CLOUDFLARE_R2_SECRET_KEY: z.string().default(''),
  CLOUDFLARE_R2_BUCKET:     z.string().default('smart-shaadi-dev'),

  AWS_REKOGNITION_REGION: z.string().default('ap-south-1'),

  DAILY_CO_API_KEY: z.string().default('mock-daily-key'),

  // Sentry — error tracking. DSN unset = no-op (see lib/sentry.ts).
  SENTRY_DSN:                z.string().default(''),
  SENTRY_ENVIRONMENT:        z.string().default('development'),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  RAZORPAY_KEY_ID:          z.string().default(''),
  RAZORPAY_KEY_SECRET:      z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET:  z.string().default(''),
  RAZORPAY_WEBHOOK_SECRETS: z.string().default(''), // comma-separated for rotation
  RAZORPAY_ACCOUNT_ID:      z.string().default(''),

  // Notifications providers
  AWS_SES_ACCESS_KEY: z.string().default(''),
  AWS_SES_SECRET_KEY: z.string().default(''),
  AWS_SES_REGION:     z.string().default('ap-south-1'),
  AWS_SES_FROM:       z.string().default('noreply@smartshaadi.co.in'),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().default(''),

  // E-invoicing (NIC IRP) — gated; threshold defaults to ₹5,00,000
  EINVOICE_API_KEY:    z.string().default(''),
  EINVOICE_THRESHOLD:  z.coerce.number().default(500000),

  // Platform tax + GSTIN. Default GSTIN is a syntactically-valid placeholder
  // for dev — override in any deployed environment.
  PLATFORM_GSTIN: z.string().default('27AAAAA0000A1Z5'),
  PLATFORM_STATE: z.string().default('Maharashtra'),

  // /metrics endpoint bearer token. Empty = open access (only safe in mock/dev).
  METRICS_TOKEN: z.string().default(''),

  // Verbose [feed] tracing in matchmaking engine — flip true on Railway when
  // debugging feed composition. Off in prod by default to keep logs clean.
  FEED_DEBUG: z.string().default('false').transform(v => v === 'true'),

  // Sentry verification endpoints — flip true temporarily to confirm Sentry
  // is capturing exceptions in a deployed env, then flip back to false.
  // When false, /api/v1/sentry-test and /__forced_error return 404.
  SENTRY_TEST_ENABLED: z.string().default('false').transform(v => v === 'true'),
}).superRefine((data, ctx) => {
  // Real-mode guard — placeholders would silently call external services with
  // fake tokens and 401 in production. Force explicit configuration.
  if (data.USE_MOCK_SERVICES) return;
  if (data.DAILY_CO_API_KEY === 'mock-daily-key') {
    ctx.addIssue({
      code: 'custom',
      path: ['DAILY_CO_API_KEY'],
      message: 'DAILY_CO_API_KEY must be set when USE_MOCK_SERVICES=false',
    });
  }
  if (!data.RAZORPAY_KEY_ID || !data.RAZORPAY_KEY_SECRET) {
    ctx.addIssue({
      code: 'custom',
      path: ['RAZORPAY_KEY_ID'],
      message: 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set when USE_MOCK_SERVICES=false',
    });
  }
  if (!data.MSG91_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['MSG91_API_KEY'],
      message: 'MSG91_API_KEY must be set when USE_MOCK_SERVICES=false',
    });
  }
  if (!data.RAZORPAY_WEBHOOK_SECRET && !data.RAZORPAY_WEBHOOK_SECRETS) {
    ctx.addIssue({
      code: 'custom',
      path: ['RAZORPAY_WEBHOOK_SECRET'],
      message: 'RAZORPAY_WEBHOOK_SECRET (or RAZORPAY_WEBHOOK_SECRETS for rotation) must be set when USE_MOCK_SERVICES=false — empty secret accepts any signature',
    });
  }
  // R2 storage — uploads/photos break in production without these.
  // S3Client constructs with blank credentials and every request 403s at runtime.
  for (const key of ['CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_ACCESS_KEY', 'CLOUDFLARE_R2_SECRET_KEY', 'CLOUDFLARE_R2_BUCKET'] as const) {
    if (!data[key]) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} must be set when USE_MOCK_SERVICES=false`,
      });
    }
  }
  if (!data.METRICS_TOKEN) {
    ctx.addIssue({
      code: 'custom',
      path: ['METRICS_TOKEN'],
      message: 'METRICS_TOKEN must be set when USE_MOCK_SERVICES=false — /metrics would otherwise be world-readable',
    });
  }
}).superRefine((data, ctx) => {
  // AI service internal key — reject the placeholder default in production.
  // The ai-service validates this header on every internal call (M2.1);
  // shipping the placeholder to prod = anyone on the network can invoke
  // /ai/horoscope/guna directly.
  if (data.NODE_ENV === 'production' && data.AI_SERVICE_INTERNAL_KEY === 'internal-key-change-in-prod') {
    ctx.addIssue({
      code: 'custom',
      path: ['AI_SERVICE_INTERNAL_KEY'],
      message: 'AI_SERVICE_INTERNAL_KEY must be changed from default placeholder in production',
    });
  }
}).superRefine((data, ctx) => {
  // Mock-mode guards (P0 #3 + #5 from docs/PHASE-1-4-AUDIT.md).
  // 1. Production must never run with mock services — a deployed mock-mode
  //    process silently no-ops every external integration (payments, OTP,
  //    KYC, video) which masquerades as a healthy app but processes nothing.
  if (data.NODE_ENV === 'production' && data.USE_MOCK_SERVICES) {
    ctx.addIssue({
      code: 'custom',
      path: ['USE_MOCK_SERVICES'],
      message: 'Mock services cannot run in production (NODE_ENV=production && USE_MOCK_SERVICES=true is forbidden — set USE_MOCK_SERVICES=false and provide real provider credentials).',
    });
  }
  // 2. In any mock-mode environment (dev, test, staging, demo) the MOCK_OTP
  //    code must be set explicitly. Removing the '123456' default closes a
  //    backdoor where anyone knowing a phone number could sign in.
  if (data.USE_MOCK_SERVICES && !data.MOCK_OTP_VALUE) {
    ctx.addIssue({
      code: 'custom',
      path: ['MOCK_OTP_VALUE'],
      message: 'MOCK_OTP_VALUE must be set when USE_MOCK_SERVICES=true (generate with `openssl rand -hex 4`; no default — the old 123456 default was a backdoor).',
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

// Loud boot-time warning whenever mock mode is active, so any deployed env
// that's still mock-gated surfaces it in startup logs — pairs with the
// production guard above (NODE_ENV=production blocks mock entirely).
if (env.USE_MOCK_SERVICES) {
  // eslint-disable-next-line no-console
  console.warn(
    `[mock-mode] env=${env.NODE_ENV} MOCK_OTP_VALUE=${env.MOCK_OTP_VALUE ?? '<unset>'} — external providers are STUBBED; DO NOT use this build for real users`,
  );
}

/**
 * Single source of truth for whether profile services should write to
 * the in-memory mockStore vs the real MongoDB Atlas connection.
 *
 * - true  → write to mockStore.json (USE_MOCK_SERVICES=true AND MONGO_LIVE not set)
 * - false → write to MongoDB via mongoose (default real-services mode, OR MONGO_LIVE=true override)
 */
export const shouldUseMockMongo = env.USE_MOCK_SERVICES && !env.MONGO_LIVE;

/**
 * Mirror of shouldUseMockMongo for R2 photo storage.
 *
 * - true  → presigned URLs route through /__mock-r2/* on the API host
 * - false → real Cloudflare R2 presigned URLs (default real-services, OR R2_LIVE=true override)
 */
export const shouldUseMockR2 = env.USE_MOCK_SERVICES && !env.R2_LIVE;
