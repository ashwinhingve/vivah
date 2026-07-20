-- Bring the production `plans` table in line with packages/types/src/plans.ts.
--
-- WHY THIS EXISTS
-- Commit 3eccd00 repriced the plans in code. seedPlans() used
-- onConflictDoNothing(), so the change reached NEW environments (no row -> insert)
-- but never EXISTING ones (row present -> insert silently discarded). Production
-- kept the pre-repricing numbers and never gained the two quarterly plans.
--
-- Applied 2026-07-20. Blast radius verified first: subscriptions = 5 (demo rows),
-- subscription_charges = 0, payments = 0. No money has ever moved through this
-- table, so correcting it is free.
--
-- Snapshot taken before running: /tmp/prodbackup/plans-before-repricing.csv
-- Rollback with exact prior values: migrations/rollback-plans-reprice.sql
--
-- IDEMPOTENT: re-running is a no-op. The UPDATEs are absolute values, not
-- deltas, and the INSERTs are guarded by ON CONFLICT (code).
--
-- razorpay_plan_id is deliberately NOT touched on the UPDATEs. It is provisioned
-- per environment and a re-seed must never clear it. (Production currently holds
-- mock_plan_* values because Razorpay is not live yet — all six plans will need
-- real plan ids provisioned before payments are enabled.)

BEGIN;

-- ── Correct the four existing plans ─────────────────────────────────────────
UPDATE plans SET amount = 499.00,  name = 'Standard Monthly' WHERE code = 'STANDARD_M';
UPDATE plans SET amount = 3999.00, name = 'Standard Yearly'  WHERE code = 'STANDARD_Y';
UPDATE plans SET amount = 999.00,  name = 'Premium Monthly'  WHERE code = 'PREMIUM_M';
UPDATE plans SET amount = 7999.00, name = 'Premium Yearly'   WHERE code = 'PREMIUM_Y';

-- ── Add the two quarterly plans that never existed here ─────────────────────
INSERT INTO plans (id, code, name, tier, interval, amount, currency, features, razorpay_plan_id, active)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-000000000011',
  'STANDARD_Q',
  'Standard Quarterly',
  'STANDARD',
  'QUARTERLY',
  1199.00,
  'INR',
  '["Unlimited matches","AI Conversation Coach","Priority visibility","Save 20%"]'::jsonb,
  'mock_plan_standard_quarterly',
  true
)
ON CONFLICT (code) DO UPDATE
  SET amount   = EXCLUDED.amount,
      name     = EXCLUDED.name,
      features = EXCLUDED.features,
      active   = EXCLUDED.active;

INSERT INTO plans (id, code, name, tier, interval, amount, currency, features, razorpay_plan_id, active)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-000000000012',
  'PREMIUM_Q',
  'Premium Quarterly',
  'PREMIUM',
  'QUARTERLY',
  2499.00,
  'INR',
  '["Everything in Standard","Verified badge","Dedicated recommendations","Save 17%"]'::jsonb,
  'mock_plan_premium_quarterly',
  true
)
ON CONFLICT (code) DO UPDATE
  SET amount   = EXCLUDED.amount,
      name     = EXCLUDED.name,
      features = EXCLUDED.features,
      active   = EXCLUDED.active;

-- ── Refresh the feature lists on the yearly/monthly plans too ───────────────
UPDATE plans SET features = '["Unlimited matches","AI Conversation Coach","Priority visibility"]'::jsonb
  WHERE code = 'STANDARD_M';
UPDATE plans SET features = '["Unlimited matches","AI Conversation Coach","Priority visibility","4 months free"]'::jsonb
  WHERE code = 'STANDARD_Y';
UPDATE plans SET features = '["Everything in Standard","Verified badge","Dedicated recommendations"]'::jsonb
  WHERE code = 'PREMIUM_M';
UPDATE plans SET features = '["Everything in Standard","Verified badge","Dedicated recommendations","4 months free"]'::jsonb
  WHERE code = 'PREMIUM_Y';

COMMIT;
