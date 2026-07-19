/**
 * Shared subscription plan definitions.
 * Single source of truth for all plan data across the application.
 *
 * Imported by:
 * - apps/api (payments/subscriptions.ts)
 * - packages/db (seed/full-demo.ts)
 * - apps/web (billing page FALLBACK_PLANS)
 */

export interface PlanRow {
  id: string;
  code: string;
  name: string;
  tier: 'STANDARD' | 'PREMIUM';
  interval: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  amount: string;
  razorpayPlanId: string;
  features: string[];
  active: boolean;
}

export const PLANS_CONSTANT: PlanRow[] = [
  // ── Standard Monthly ────────────────────────────────────────────────────────
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
    code: 'STANDARD_M',
    name: 'Standard Monthly',
    tier: 'STANDARD',
    interval: 'MONTHLY',
    amount: '499.00',
    razorpayPlanId: 'mock_plan_standard_monthly',
    features: [
      'Unlimited matches',
      'AI Conversation Coach',
      'Priority visibility',
    ],
    active: true,
  },

  // ── Standard Quarterly ──────────────────────────────────────────────────────
  // Saves 20%: 3×₹499 = ₹1497, charged ₹1199 = ₹298 saved = 20%
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000011',
    code: 'STANDARD_Q',
    name: 'Standard Quarterly',
    tier: 'STANDARD',
    interval: 'QUARTERLY',
    amount: '1199.00',
    razorpayPlanId: 'mock_plan_standard_quarterly',
    features: [
      'Unlimited matches',
      'AI Conversation Coach',
      'Priority visibility',
      'Save 20%',
    ],
    active: true,
  },

  // ── Standard Yearly ────────────────────────────────────────────────────────
  // Saves 4 months: 12×₹499 = ₹5988, charged ₹3999 = pays for ~8 months
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000021',
    code: 'STANDARD_Y',
    name: 'Standard Yearly',
    tier: 'STANDARD',
    interval: 'YEARLY',
    amount: '3999.00',
    razorpayPlanId: 'mock_plan_standard_yearly',
    features: [
      'Unlimited matches',
      'AI Conversation Coach',
      'Priority visibility',
      '4 months free',
    ],
    active: true,
  },

  // ── Premium Monthly ────────────────────────────────────────────────────────
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002',
    code: 'PREMIUM_M',
    name: 'Premium Monthly',
    tier: 'PREMIUM',
    interval: 'MONTHLY',
    amount: '999.00',
    razorpayPlanId: 'mock_plan_premium_monthly',
    features: [
      'Everything in Standard',
      'Verified badge',
      'Dedicated recommendations',
    ],
    active: true,
  },

  // ── Premium Quarterly ──────────────────────────────────────────────────────
  // Saves 17%: 3×₹999 = ₹2997, charged ₹2499 = ₹498 saved = 17%
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000012',
    code: 'PREMIUM_Q',
    name: 'Premium Quarterly',
    tier: 'PREMIUM',
    interval: 'QUARTERLY',
    amount: '2499.00',
    razorpayPlanId: 'mock_plan_premium_quarterly',
    features: [
      'Everything in Standard',
      'Verified badge',
      'Dedicated recommendations',
      'Save 17%',
    ],
    active: true,
  },

  // ── Premium Yearly ──────────────────────────────────────────────────────
  // Saves 4 months: 12×₹999 = ₹11988, charged ₹7999 = pays for ~8 months
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000022',
    code: 'PREMIUM_Y',
    name: 'Premium Yearly',
    tier: 'PREMIUM',
    interval: 'YEARLY',
    amount: '7999.00',
    razorpayPlanId: 'mock_plan_premium_yearly',
    features: [
      'Everything in Standard',
      'Verified badge',
      'Dedicated recommendations',
      '4 months free',
    ],
    active: true,
  },
];
