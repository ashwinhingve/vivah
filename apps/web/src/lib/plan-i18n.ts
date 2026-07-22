/**
 * Localizes DB-seeded subscription plan content.
 *
 * Plan rows (packages/db/constants/plans.ts) are seeded with English `name`
 * and `features` strings, so API responses render English on Hindi pages.
 * `code` is the stable unique identifier, so names are keyed by code and
 * feature strings by their exact seeded English literal. Anything unknown
 * (a future plan or an edited feature string) falls back to the DB value —
 * degrading to English, never to a raw message key.
 *
 * Keys live under the `planCatalog` namespace in apps/web/messages/{en,hi}.json.
 * Pass `t = await getTranslations('planCatalog')` from the consuming page.
 */

type PlanCatalogTranslator = (key: string) => string;

const PLAN_NAME_KEYS: Record<string, string> = {
  STANDARD_M: 'names.standardMonthly',
  STANDARD_Q: 'names.standardQuarterly',
  STANDARD_Y: 'names.standardYearly',
  PREMIUM_M: 'names.premiumMonthly',
  PREMIUM_Q: 'names.premiumQuarterly',
  PREMIUM_Y: 'names.premiumYearly',
};

const FEATURE_KEYS: Record<string, string> = {
  'Unlimited matches': 'features.unlimitedMatches',
  'AI Conversation Coach': 'features.aiConversationCoach',
  'Priority visibility': 'features.priorityVisibility',
  'Save 20%': 'features.save20',
  'Save 17%': 'features.save17',
  '4 months free': 'features.fourMonthsFree',
  'Everything in Standard': 'features.everythingInStandard',
  'Verified badge': 'features.verifiedBadge',
  'Dedicated recommendations': 'features.dedicatedRecommendations',
};

export function localizePlanName(t: PlanCatalogTranslator, code: string, dbName: string): string {
  const key = PLAN_NAME_KEYS[code];
  return key ? t(key) : dbName;
}

export function localizePlanFeatures(t: PlanCatalogTranslator, features: unknown): string[] {
  const list = Array.isArray(features)
    ? features.filter((f): f is string => typeof f === 'string')
    : [];
  return list.map((f) => {
    const key = FEATURE_KEYS[f];
    return key ? t(key) : f;
  });
}
