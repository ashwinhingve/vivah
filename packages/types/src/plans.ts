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

export interface MonthlySavings {
  savedAmount: number;
  percent: number;
}

/**
 * Calculate savings vs Smart Shaadi's monthly plan of the same tier.
 *
 * Returns null if:
 * - The plan is already monthly
 * - The tier's monthly counterpart is missing from the provided plan list
 *
 * @param plan The plan to calculate savings for
 * @param allPlans All available plans (used to find the monthly counterpart)
 * @returns {MonthlySavings | null} Savings object with amount and percent, or null if not applicable
 */
export function monthlySavings(plan: PlanRow, allPlans: PlanRow[]): MonthlySavings | null {
  // Monthly plans have no savings to display
  if (plan.interval === 'MONTHLY') {
    return null;
  }

  // Get the period multiplier
  const periods = plan.interval === 'QUARTERLY' ? 3 : plan.interval === 'YEARLY' ? 12 : 1;
  if (periods === 1) {
    return null;
  }

  // Find the monthly plan of the same tier
  const monthlyPlan = allPlans.find(
    (p) => p.tier === plan.tier && p.interval === 'MONTHLY' && p.active,
  );

  if (!monthlyPlan) {
    return null;
  }

  // Parse amounts carefully (they are decimal strings, not floats)
  const monthlyAmount = Number.parseFloat(monthlyPlan.amount);
  const planAmount = Number.parseFloat(plan.amount);

  if (Number.isNaN(monthlyAmount) || Number.isNaN(planAmount)) {
    return null;
  }

  // Calculate the equivalent cost of paying monthly for this period
  const equivalentMonthlyTotal = monthlyAmount * periods;

  // Calculate savings
  const savedAmount = Math.round(equivalentMonthlyTotal - planAmount);

  // Calculate percentage (avoid division by zero, round to whole number)
  const percent = Math.round((savedAmount / equivalentMonthlyTotal) * 100);

  // Only return if there is actual savings
  if (savedAmount <= 0) {
    return null;
  }

  return { savedAmount, percent };
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
