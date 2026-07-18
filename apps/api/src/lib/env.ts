import { config } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Load root .env before validation.
// env.ts lives at apps/api/src/lib/ — root is 4 levels up.
config({ path: resolve(__dirname, '../../../../.env'), override: true });

export const envSchema = z.object({
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

  // Opt-in to run the notifications BullMQ worker even in mock/dev mode, so the
  // realtime bell can be exercised locally without USE_MOCK_SERVICES=false.
  NOTIFICATIONS_WORKER_ENABLED: z.string().default('false').transform(v => v === 'true'),

  // MongoDB live override: when 'true', connect to MongoDB even if USE_MOCK_SERVICES=true.
  // Lets us use real Mongo Atlas in production while keeping OTP/Razorpay/etc. mocked
  // until those provider registrations are completed.
  MONGO_LIVE: z.string().default('false').transform(v => v === 'true'),

  // R2 live override: when 'true', use real Cloudflare R2 even if USE_MOCK_SERVICES=true.
  // Lets us flip photos to real R2 in production without dropping the global mock flag.
  R2_LIVE: z.string().default('false').transform(v => v === 'true'),

  // Video (Daily.co) live override — escape-early like R2_LIVE. When 'true',
  // create REAL Daily.co rooms even if USE_MOCK_SERVICES=true, so video calls
  // go live while Razorpay/MSG91 stay mocked. Requires a real DAILY_CO_API_KEY.
  // shouldUseMockVideo = USE_MOCK_SERVICES && !VIDEO_LIVE.
  VIDEO_LIVE: z.string().default('false').transform(v => v === 'true'),

  // KYC live override — INVERTED semantics vs MONGO_LIVE/R2_LIVE. KYC (DigiLocker/
  // Aadhaar/PAN/bank/criminal/faceMatch/liveness) stays MOCKED unless KYC_LIVE='true'.
  // This lets us flip USE_MOCK_SERVICES=false at payment-launch (real Razorpay + MSG91)
  // while DigiLocker is still unregistered — KYC keeps returning mock results and the
  // user-facing flow still reaches MANUAL_REVIEW for admin approval. Set KYC_LIVE=true
  // only once DigiLocker creds (DIGILOCKER_CLIENT_ID/SECRET) are configured.
  KYC_LIVE: z.string().default('false').transform(v => v === 'true'),

  // E-sign live override — INVERTED semantics like KYC. E-sign (contract/document
  // signing via DigiLocker/Signzy) stays MOCKED unless ESIGN_LIVE='true'. Real e-sign
  // happens only when ESIGN_LIVE=true AND USE_MOCK_SERVICES=false. Set ESIGN_LIVE=true
  // once e-sign provider credentials are fully configured.
  ESIGN_LIVE: z.string().default('false').transform(v => v === 'true'),

  // ── Phase 6 (Tier 2/3) live overrides — INVERTED semantics like KYC/ESIGN ──
  // WhatsApp Business (6.1), lending placement (6.2), insurance placement (6.3)
  // stay MOCKED unless their *_LIVE flag is 'true' AND USE_MOCK_SERVICES=false.
  // Lending/insurance are Tier 3 (blocked on partner + regulator agreements);
  // WhatsApp is Tier 2 (blocked on Meta Business + BSP approval). The live swap
  // is a credentials change, not a redesign. Guarded creds below via superRefine.
  WHATSAPP_LIVE:  z.string().default('false').transform(v => v === 'true'),
  LENDING_LIVE:   z.string().default('false').transform(v => v === 'true'),
  INSURANCE_LIVE: z.string().default('false').transform(v => v === 'true'),

  // ── Phase 7 Sprint F — churn-recovery outreach gate (Unit 7.3) ──
  // When FALSE (default), the daily sweep computes + STORES recovery attempts as
  // DRY_RUN for admin review but messages NO user — safe to run pre-launch. Set
  // 'true' (with USE_MOCK_SERVICES=false) to actually enqueue win-back nudges.
  RETENTION_OUTREACH_LIVE: z.string().default('false').transform(v => v === 'true'),

  // ── Phase 7 Sprint G — NRI / international matching gate (Unit 7.2) ──
  // When FALSE (default), the cross-border escape hatch in passesDistanceFilter
  // is never taken, so the match feed behaves EXACTLY as it did before Sprint G:
  // the 100km haversine limit applies to every pair with coordinates. The NRI
  // profile fields still store fine; they just don't influence matching yet.
  // Set 'true' after launch validation to surface cross-border pairs where BOTH
  // sides have opted in. Unit 7.2 is Tier 2 — go-live gated, not partner-blocked.
  NRI_MATCHING_LIVE: z.string().default('false').transform(v => v === 'true'),

  // ── Phase 8 Sprint H — PDF report kill-switch (Unit 8.3) ──
  // Deliberately NOT named *_LIVE and defaults to TRUE, inverting the mock-matrix
  // convention above, because the semantics are the opposite: reports call no
  // external provider and carry no go-live risk, so there is nothing to keep
  // mocked. This exists purely as a load-shedding lever — report rendering is
  // synchronous, CPU-heavy PDFKit work on the API process, so ops needs a way to
  // shed it under pressure without shipping a deploy. Set 'false' to make the
  // report endpoints return 503 while leaving the rest of the API untouched.
  REPORTS_ENABLED: z.string().default('true').transform(v => v !== 'false'),

  // ── Phase 6 Sprint J — Auto-Marketing Engine kill-switch (Unit 6.4) ──
  // TRUE by default, REPORTS_ENABLED-style: the engine has no external provider
  // of its own — delivery rides the existing notification pipeline, which is
  // already gated per-channel (USE_MOCK_SERVICES for SES/FCM, WHATSAPP_LIVE,
  // …). The real send guardrails are the campaign lifecycle (nothing sends
  // until ACTIVE + approved content) and per-user marketing consent
  // (notification_preferences.marketing, default false). Set 'false' to halt
  // all campaign dispatch/sweeps in an incident without a deploy; sends are
  // then recorded as SUPPRESSED(KILL_SWITCH), never silently dropped.
  MARKETING_AUTOMATION_ENABLED: z.string().default('true').transform(v => v !== 'false'),

  // WhatsApp Cloud API creds — only required when WHATSAPP_LIVE=true.
  WHATSAPP_API_KEY:            z.string().default(''),
  WHATSAPP_PHONE_NUMBER_ID:    z.string().default(''),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default(''),
  // Lending aggregator/LSP creds — only required when LENDING_LIVE=true.
  LENDING_API_KEY: z.string().default(''),
  // Insurance aggregator creds — only required when INSURANCE_LIVE=true.
  INSURANCE_API_KEY: z.string().default(''),

  // Pre-launch escape hatch: when 'true', the NODE_ENV=production +
  // USE_MOCK_SERVICES=true guard is bypassed. Intended for the pre-launch
  // window where external provider creds (MSG91 DLT, DigiLocker, Razorpay
  // live, Daily.co) are still pending. With this on, auth + KYC + payment
  // routes will 500 at request time; do NOT keep this set once real creds
  // land. Boot logs emit a loud warning whenever this is active.
  ALLOW_MOCK_SERVICES_IN_PROD: z.string().default('false').transform(v => v === 'true'),

  // Mock OTP override value — REQUIRED whenever USE_MOCK_SERVICES=true,
  // enforced by a superRefine below. No default (the old '123456' default
  // was a backdoor on any deployed mock-mode env). Use
  // `openssl rand -hex 4` to generate a fresh value per environment.
  MOCK_OTP_VALUE: z.string().optional(),

  MSG91_API_KEY:      z.string().default(''),
  MSG91_TEMPLATE_ID:  z.string().default(''),

  API_BASE_URL: z.string().url('API_BASE_URL must be a valid URL').default('http://localhost:4000'),
  WEB_URL: z.string().url('WEB_URL must be a valid URL').default('http://localhost:3000'),

  // CORS override — optional; when set, prepended to the production
  // allowedOrigins list in index.ts + chat/socket/index.ts. Empty in dev
  // (the local WEB_URL covers it).
  CORS_ORIGIN: z.string().default(''),

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
  // S3-compatible endpoint. When set, used verbatim; otherwise derived from
  // the account id (<account>.r2.cloudflarestorage.com).
  CLOUDFLARE_R2_ENDPOINT:   z.string().default(''),
  // Public base URL for serving objects (documentation/serving — presigned GETs
  // remain the default read path for private photos).
  CLOUDFLARE_R2_PUBLIC_URL: z.string().default(''),

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
  //    Pre-launch escape hatch: ALLOW_MOCK_SERVICES_IN_PROD=true bypasses
  //    this guard so the app can boot in degraded mode while external
  //    provider creds are still pending. See ALLOW_MOCK_SERVICES_IN_PROD
  //    schema doc above.
  if (
    data.NODE_ENV === 'production' &&
    data.USE_MOCK_SERVICES &&
    !data.ALLOW_MOCK_SERVICES_IN_PROD
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['USE_MOCK_SERVICES'],
      message: 'Mock services cannot run in production (NODE_ENV=production && USE_MOCK_SERVICES=true is forbidden — set USE_MOCK_SERVICES=false and provide real provider credentials, OR set ALLOW_MOCK_SERVICES_IN_PROD=true to explicitly run prod in mocked/degraded mode while external creds are pending — auth, KYC, and payment routes will fail at request time).',
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
}).superRefine((data, ctx) => {
  // Per-service LIVE overrides (R2_LIVE / VIDEO_LIVE) make REAL external calls
  // while USE_MOCK_SERVICES is still true — so the block above (which only checks
  // creds when the master toggle is OFF) never sees them. Guard each live-escape's
  // credentials here so flipping the flag without creds fails at boot, not at
  // runtime with a 401/403.
  if (data.R2_LIVE) {
    for (const key of ['CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_ACCESS_KEY', 'CLOUDFLARE_R2_SECRET_KEY', 'CLOUDFLARE_R2_BUCKET'] as const) {
      if (!data[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} must be set when R2_LIVE=true` });
      }
    }
  }
  if (data.VIDEO_LIVE && (!data.DAILY_CO_API_KEY || data.DAILY_CO_API_KEY === 'mock-daily-key')) {
    ctx.addIssue({
      code: 'custom',
      path: ['DAILY_CO_API_KEY'],
      message: 'DAILY_CO_API_KEY must be set to a real key when VIDEO_LIVE=true',
    });
  }
}).superRefine((data, ctx) => {
  // Phase 6 live overrides (WhatsApp / lending / insurance). Same rationale as
  // R2_LIVE/VIDEO_LIVE: flipping a *_LIVE flag makes REAL external calls, so its
  // credentials must be present at boot, not discovered missing at request time.
  if (data.WHATSAPP_LIVE) {
    for (const key of ['WHATSAPP_API_KEY', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID'] as const) {
      if (!data[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} must be set when WHATSAPP_LIVE=true` });
      }
    }
  }
  if (data.LENDING_LIVE && !data.LENDING_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['LENDING_API_KEY'], message: 'LENDING_API_KEY must be set when LENDING_LIVE=true' });
  }
  if (data.INSURANCE_LIVE && !data.INSURANCE_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['INSURANCE_API_KEY'], message: 'INSURANCE_API_KEY must be set when INSURANCE_LIVE=true' });
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
// production guard above. NODE_ENV=production normally blocks mock mode;
// ALLOW_MOCK_SERVICES_IN_PROD=true bypasses the guard for the pre-launch
// window, in which case the warning is upgraded to an error-level log so
// it cannot be missed.
if (env.USE_MOCK_SERVICES) {
  const inProd = env.NODE_ENV === 'production';
  const message = `[mock-mode] env=${env.NODE_ENV} MOCK_OTP_VALUE=${env.MOCK_OTP_VALUE ?? '<unset>'} — external providers are STUBBED; DO NOT use this build for real users${inProd ? ' (ALLOW_MOCK_SERVICES_IN_PROD override is ACTIVE — auth/KYC/payments will fail at request time)' : ''}`;
  // eslint-disable-next-line no-console
  (inProd ? console.error : console.warn)(message);
}

/**
 * Pure derivation of the per-store mock/live gates from the raw flags. Extracted
 * so the read AND write paths of every store consult one formula (a divergence
 * here is the demo-week class of bug — writes live, reads mock). Pure + exported
 * so flagParity.test.ts can assert the full truth table without env gymnastics.
 *
 * - shouldUseMockMongo:  USE_MOCK_SERVICES=true AND MONGO_LIVE not set
 * - shouldUseMockR2:     USE_MOCK_SERVICES=true AND R2_LIVE not set
 * - shouldUseMockVideo:  USE_MOCK_SERVICES=true AND VIDEO_LIVE not set
 * (MONGO_LIVE / R2_LIVE / VIDEO_LIVE let a backend go real while the master
 *  toggle stays on — they escape to live EARLY.)
 *
 * - shouldUseMockKyc: USE_MOCK_SERVICES=true OR KYC_LIVE not set — INVERTED logic.
 *   Unlike the gates above (which escape to live EARLY), KYC_LIVE keeps KYC
 *   MOCKED even after the master toggle flips off, so DigiLocker stays stubbed
 *   until its creds land. Real KYC happens only when KYC_LIVE=true AND
 *   USE_MOCK_SERVICES=false.
 *
 * - shouldUseMockEsign: USE_MOCK_SERVICES=true OR ESIGN_LIVE not set — INVERTED logic.
 *   Like KYC, e-sign stays MOCKED even after the master toggle flips off, so
 *   DigiLocker/Signzy stays stubbed until their creds land. Real e-sign happens only
 *   when ESIGN_LIVE=true AND USE_MOCK_SERVICES=false.
 */
export function deriveMockFlags(
  useMockServices: boolean,
  mongoLive: boolean,
  r2Live: boolean,
  kycLive = false,
  videoLive = false,
  esignLive = false,
  whatsAppLive = false,
  lendingLive = false,
  insuranceLive = false,
): {
  shouldUseMockMongo: boolean;
  shouldUseMockR2: boolean;
  shouldUseMockKyc: boolean;
  shouldUseMockVideo: boolean;
  shouldUseMockEsign: boolean;
  shouldUseMockWhatsApp: boolean;
  shouldUseMockLending: boolean;
  shouldUseMockInsurance: boolean;
} {
  return {
    shouldUseMockMongo: useMockServices && !mongoLive,
    shouldUseMockR2:    useMockServices && !r2Live,
    shouldUseMockKyc:   useMockServices || !kycLive,
    shouldUseMockVideo: useMockServices && !videoLive,
    shouldUseMockEsign: useMockServices || !esignLive,
    // Phase 6 — INVERTED semantics (mocked until explicitly live), like KYC/ESIGN.
    shouldUseMockWhatsApp:  useMockServices || !whatsAppLive,
    shouldUseMockLending:   useMockServices || !lendingLive,
    shouldUseMockInsurance: useMockServices || !insuranceLive,
  };
}

/**
 * Single source of truth for whether profile services should write to
 * the in-memory mockStore vs the real MongoDB Atlas connection.
 */
export const shouldUseMockMongo = deriveMockFlags(
  env.USE_MOCK_SERVICES, env.MONGO_LIVE, env.R2_LIVE,
).shouldUseMockMongo;

/**
 * Mirror of shouldUseMockMongo for R2 photo storage.
 */
export const shouldUseMockR2 = deriveMockFlags(
  env.USE_MOCK_SERVICES, env.MONGO_LIVE, env.R2_LIVE,
).shouldUseMockR2;

/**
 * KYC mock gate. True (mocked) unless KYC_LIVE=true AND USE_MOCK_SERVICES=false.
 * Keeps DigiLocker stubbed through the payment-launch master flip — see deriveMockFlags.
 */
export const shouldUseMockKyc = deriveMockFlags(
  env.USE_MOCK_SERVICES, env.MONGO_LIVE, env.R2_LIVE, env.KYC_LIVE,
).shouldUseMockKyc;

/**
 * Video (Daily.co) mock gate. Mirrors shouldUseMockR2 — mock unless VIDEO_LIVE=true
 * escapes the master toggle. Real Daily.co rooms only when NOT mocked.
 */
export const shouldUseMockVideo = deriveMockFlags(
  env.USE_MOCK_SERVICES, env.MONGO_LIVE, env.R2_LIVE, env.KYC_LIVE, env.VIDEO_LIVE,
).shouldUseMockVideo;

/**
 * E-sign (contract signing) mock gate. True (mocked) unless ESIGN_LIVE=true AND
 * USE_MOCK_SERVICES=false. Keeps e-sign stubbed through the payment-launch master
 * flip — see deriveMockFlags. Mirror of KYC inverted semantics.
 */
export const shouldUseMockEsign = deriveMockFlags(
  env.USE_MOCK_SERVICES, env.MONGO_LIVE, env.R2_LIVE, env.KYC_LIVE, env.VIDEO_LIVE, env.ESIGN_LIVE,
).shouldUseMockEsign;

/**
 * WhatsApp Business mock gate. True (mocked) unless WHATSAPP_LIVE=true AND
 * USE_MOCK_SERVICES=false. Keeps Meta/BSP sends stubbed until credentials land.
 */
export const shouldUseMockWhatsApp = deriveMockFlags(
  env.USE_MOCK_SERVICES, env.MONGO_LIVE, env.R2_LIVE, env.KYC_LIVE, env.VIDEO_LIVE, env.ESIGN_LIVE,
  env.WHATSAPP_LIVE,
).shouldUseMockWhatsApp;

/**
 * Lending placement mock gate. True (mocked) unless LENDING_LIVE=true AND
 * USE_MOCK_SERVICES=false. Tier 3 — no real lender call ever ships until a
 * partner + RBI-DLG compliance agreement lands. Mock returns fake offers only.
 */
export const shouldUseMockLending = deriveMockFlags(
  env.USE_MOCK_SERVICES, env.MONGO_LIVE, env.R2_LIVE, env.KYC_LIVE, env.VIDEO_LIVE, env.ESIGN_LIVE,
  env.WHATSAPP_LIVE, env.LENDING_LIVE,
).shouldUseMockLending;

/**
 * Insurance placement mock gate. True (mocked) unless INSURANCE_LIVE=true AND
 * USE_MOCK_SERVICES=false. Tier 3 — no real insurer call until an IRDAI-compliant
 * aggregator agreement lands. Mock returns fake quotes only.
 */
export const shouldUseMockInsurance = deriveMockFlags(
  env.USE_MOCK_SERVICES, env.MONGO_LIVE, env.R2_LIVE, env.KYC_LIVE, env.VIDEO_LIVE, env.ESIGN_LIVE,
  env.WHATSAPP_LIVE, env.LENDING_LIVE, env.INSURANCE_LIVE,
).shouldUseMockInsurance;

/**
 * Churn-recovery outreach gate (Phase 7 Sprint F, Unit 7.3). FALSE by default —
 * the daily sweep stores recovery attempts as DRY_RUN for admin review and
 * messages no one. TRUE (with USE_MOCK_SERVICES=false) actually enqueues the
 * win-back notification. A distinct gate, not part of the mock-services matrix.
 */
export const shouldSendRetentionOutreach =
  env.RETENTION_OUTREACH_LIVE && !env.USE_MOCK_SERVICES;

/**
 * Cross-border matching gate (Phase 7 Sprint G, Unit 7.2). FALSE by default —
 * passesDistanceFilter never takes the NRI escape hatch, so the feed is
 * byte-identical to pre-Sprint-G.
 *
 * Deliberately NOT gated on USE_MOCK_SERVICES: unlike outreach or payments, this
 * calls no external provider — it only decides whether an already-stored,
 * user-set preference is honoured. Tying it to the mock matrix would make the
 * feature untestable in the very mock mode the whole dev environment runs in.
 */
export const isNriMatchingLive = env.NRI_MATCHING_LIVE;

/**
 * PDF report kill-switch (Phase 8 Sprint H, Unit 8.3). TRUE by default — reports
 * are an authenticated, role-gated read over data the analytics layer already
 * computes, so there is no provider to mock and no launch blocker to gate on.
 *
 * Flip to FALSE only to shed the synchronous PDFKit render load in an incident;
 * the report endpoints then return 503 and nothing else is affected.
 */
export const areReportsEnabled = env.REPORTS_ENABLED;

/**
 * Auto-marketing kill-switch (Phase 6 Sprint J, Unit 6.4). TRUE by default —
 * the engine only feeds the existing notification pipeline, whose channels are
 * individually mock/flag-gated already, and per-user marketing consent plus the
 * campaign approval lifecycle are the real guardrails. Deliberately NOT tied to
 * USE_MOCK_SERVICES for the same reason as isNriMatchingLive: coupling it to
 * the mock matrix would make the engine untestable in the mock mode the whole
 * dev environment runs in. FALSE = dispatch/sweeps record SUPPRESSED rows.
 */
export const isMarketingAutomationEnabled = env.MARKETING_AUTOMATION_ENABLED;
