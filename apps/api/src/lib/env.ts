import { config } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Load root .env before validation.
// env.ts lives at apps/api/src/lib/ — root is 4 levels up.
config({ path: resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for HS256 security'),

  MSG91_API_KEY: z.string().min(1, 'MSG91_API_KEY is required'),
  MSG91_TEMPLATE_ID: z.string().min(1, 'MSG91_TEMPLATE_ID is required'),

  API_BASE_URL: z.string().url('API_BASE_URL must be a valid URL').default('http://localhost:4000'),
  WEB_URL: z.string().url('WEB_URL must be a valid URL').default('http://localhost:3000'),

  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),

  USE_MOCK_SERVICES: z.string().default('true'),

  CLOUDFLARE_R2_ACCOUNT_ID: z.string().min(1, 'CLOUDFLARE_R2_ACCOUNT_ID is required'),
  CLOUDFLARE_R2_ACCESS_KEY: z.string().min(1, 'CLOUDFLARE_R2_ACCESS_KEY is required'),
  CLOUDFLARE_R2_SECRET_KEY: z.string().min(1, 'CLOUDFLARE_R2_SECRET_KEY is required'),
  CLOUDFLARE_R2_BUCKET:     z.string().min(1, 'CLOUDFLARE_R2_BUCKET is required'),

  AWS_REKOGNITION_REGION: z.string().min(1).default('ap-south-1'),
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
