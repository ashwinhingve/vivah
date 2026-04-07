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

  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').default('http://localhost:3000'),

  CLOUDFLARE_R2_ACCOUNT_ID: z.preprocess(v => v || 'unset-r2-account-id', z.string()),
  CLOUDFLARE_R2_ACCESS_KEY: z.preprocess(v => v || 'unset-r2-access-key', z.string()),
  CLOUDFLARE_R2_SECRET_KEY: z.preprocess(v => v || 'unset-r2-secret-key', z.string()),
  CLOUDFLARE_R2_BUCKET:     z.preprocess(v => v || 'vivah-os-media',      z.string()),

  AWS_REKOGNITION_REGION: z.string().default('ap-south-1'),
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
