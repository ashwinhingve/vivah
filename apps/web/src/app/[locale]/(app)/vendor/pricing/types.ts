// Wire shapes returned by /api/v1/pricing/* — paise arrives as a decimal STRING
// (Money.paise is a bigint server-side; JSON can't carry bigint). See the API's
// apps/api/src/pricing/serialize.ts.

export interface WireMoney {
  paise: string;
  currency: string;
}

export interface WirePricingRule {
  id: string;
  profileId: string;
  serviceCategory: string;
  base: WireMoney;
  floorMultiplier: number;
  ceilingMultiplier: number;
  muhuratMultiplier: number;
  offSeasonMultiplier: number;
  demandMultiplier: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface WirePricingSuggestion {
  ruleId: string;
  profileId: string;
  base: WireMoney;
  appliedFactors: { MUHURAT: number; OFFSEASON: number; DEMAND: number };
  rawMultiplier: number;
  clampedMultiplier: number;
  suggested: WireMoney;
  overridable: boolean;
  explanationEn: string;
  explanationHi: string;
}
