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

  // Platform tax + GSTIN
  PLATFORM_GSTIN: z.string().default('27AAAAA0000A1Z5'),
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
