/** Shared shapes for the /admin/analytics dashboard (mirror API envelopes). */

export type Trend = 'up' | 'down' | 'flat';

export interface KpiMetric {
  value: number;
  changePct: number | null;
  trend: Trend;
}

export interface Overview {
  totalUsers: KpiMetric;
  activeMatches: KpiMetric;
  revenueMtd: KpiMetric;
  avgCompatScore: KpiMetric;
}

export interface SignupPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface MatchWeek {
  week: string; // YYYY-Www
  sent: number;
  accepted: number;
}

export type StayTier = 'ENGAGED' | 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';

export interface StayBucket {
  tier: StayTier;
  count: number;
}

export interface RevenueMonth {
  month: string; // YYYY-MM
  standard_m: number;
  standard_y: number;
  premium_m: number;
  premium_y: number;
}

export interface TopMatch {
  userA: string;
  userB: string;
  totalScore: number;
  gunaMilanScore: number | null;
  fiiBand: string;
  computedAt: string;
}
