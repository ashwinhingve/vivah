/**
 * fiiScore.ts — Family Inclination Index (FII) signal encoder + MongoDB extractor.
 *
 * Two exports:
 *   encodeFamilySignals(section)  — deterministic 7-signal encoder (0-100 each)
 *                                   shared by scoreFamilySection + extractFiiSignals
 *   extractFiiSignals(profileId)  — fetch MongoDB FamilySection and encode
 *
 * All null/missing fields contribute 0 to the weighted sum (NOT a default of 50).
 * Missing means the user hasn't filled in the field — we don't fabricate signal.
 *
 * Architecture Rules honoured:
 *   Rule 11 — every Mongoose call has USE_MOCK_SERVICES guard
 *   Rule 4  — no `any`; unknown narrowed explicitly
 */
import { shouldUseMockMongo } from '../lib/env.js';
import { mockGet } from '../lib/mockStore.js';
import { ProfileContent as _ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { FamilySection } from '@smartshaadi/types';
import type { Model } from 'mongoose';

// ── Internal cast so we can call .findOne().select().lean() ──────────────────
interface IProfileContentModel extends Model<Record<string, unknown>> {}
const ProfileContent = _ProfileContent as unknown as IProfileContentModel;

// ── FiiSignals — the 7 normalised 0-100 values expected by ai-service ────────

export interface FiiSignals {
  family_type_preference:    number; // 0-100
  family_values_orientation: number;
  parents_living_intent:     number;
  family_decisions:          number;
  cultural_events:           number;
  siblings_engagement:       number;
  religious_practice:        number;
}

// ── Encoding tables (weights listed for reference; encoding only here) ────────

function encodeTypePref(v: FamilySection['familyType']): number | null {
  if (!v) return null;
  const map: Record<string, number> = { JOINT: 100, EXTENDED: 70, NUCLEAR: 30 };
  return map[v] ?? null;
}

function encodeValuesPref(v: FamilySection['familyValues']): number | null {
  if (!v) return null;
  const map: Record<string, number> = { TRADITIONAL: 100, MODERATE: 60, LIBERAL: 20 };
  return map[v] ?? null;
}

function encodeParentsLiving(v: FamilySection['parentsLivingSituation']): number | null {
  if (!v) return null;
  const map: Record<string, number> = {
    YES_COMMITTED:   100,
    OPEN:            70,
    NO_OBJECTION:    50,
    PREFER_SEPARATE: 20,
  };
  return map[v] ?? null;
}

function encodeFamilyDecisions(v: FamilySection['familyDecisionInvolvement']): number | null {
  if (!v) return null;
  const map: Record<string, number> = {
    HIGH_COLLABORATIVE: 100,
    CONSULTATIVE:        75,
    INFORMED_ONLY:       40,
    INDEPENDENT:         10,
  };
  return map[v] ?? null;
}

function encodeCulturalEvents(v: FamilySection['culturalEventsAttendance']): number | null {
  if (!v) return null;
  const map: Record<string, number> = {
    ALWAYS:          100,
    IMPORTANT_ONLY:   70,
    OCCASIONALLY:     40,
    RARELY:           15,
  };
  return map[v] ?? null;
}

function encodeSiblings(siblings: FamilySection['siblings']): number | null {
  if (!siblings) return null;
  const count = siblings.length;
  if (count === 0) return 20;
  if (count === 1) return 50;
  if (count === 2) return 70;
  return 90; // 3+
}

function encodeReligiousPractice(v: FamilySection['religiousObservanceWithFamily']): number | null {
  if (!v) return null;
  const map: Record<string, number> = {
    VERY_ACTIVE_TOGETHER:   100,
    ACTIVE_INDIVIDUALLY:     75,
    OCCASIONAL:              50,
    PERSONAL_ONLY:           25,
    NOT_PRACTICING:          10,
  };
  return map[v] ?? null;
}

// ── encodeFamilySignals — shared pure encoder ─────────────────────────────────

/**
 * Map a FamilySection (from MongoDB) to the 7 FiiSignals (0-100 each).
 * Null/missing → 0 (not a default 50 — missing means no signal).
 */
export function encodeFamilySignals(section: FamilySection | null | undefined): FiiSignals {
  const s = section ?? {};
  return {
    family_type_preference:    encodeTypePref(s.familyType)                       ?? 0,
    family_values_orientation: encodeValuesPref(s.familyValues)                   ?? 0,
    parents_living_intent:     encodeParentsLiving(s.parentsLivingSituation)       ?? 0,
    family_decisions:          encodeFamilyDecisions(s.familyDecisionInvolvement)  ?? 0,
    cultural_events:           encodeCulturalEvents(s.culturalEventsAttendance)    ?? 0,
    siblings_engagement:       encodeSiblings(s.siblings)                          ?? 0,
    religious_practice:        encodeReligiousPractice(s.religiousObservanceWithFamily) ?? 0,
  };
}

// ── computeFiiScoreFromSignals — weighted sum → 0-100 integer ────────────────

/**
 * Compute the single 0-100 FII score from the 7 signals.
 * Null/missing signals contribute 0 (weight is still applied, but value=0).
 */
export function computeFiiScoreFromSignals(signals: FiiSignals): number {
  const WEIGHTS: Record<keyof FiiSignals, number> = {
    family_type_preference:    0.20,
    family_values_orientation: 0.15,
    parents_living_intent:     0.18,
    family_decisions:          0.15,
    cultural_events:           0.12,
    siblings_engagement:       0.07,
    religious_practice:        0.13,
  };

  let total = 0;
  for (const [key, weight] of Object.entries(WEIGHTS) as [keyof FiiSignals, number][]) {
    total += signals[key] * weight;
  }
  return Math.min(100, Math.max(0, Math.round(total)));
}

// ── extractFiiSignals — MongoDB fetch + encode (Rule 11 guard) ────────────────

/**
 * Fetch the FamilySection for a profile from MongoDB (or mock store in dev)
 * and return the 7 normalised FiiSignals.
 *
 * profileId here is the MongoDB/content userId (i.e., the Better Auth userId),
 * matching how ProfileContent is keyed. Callers resolve userId separately.
 */
export async function extractFiiSignals(userId: string): Promise<FiiSignals> {
  let familySection: FamilySection | null = null;

  if (shouldUseMockMongo) {
    const doc = mockGet(userId) as Record<string, unknown> | null;
    if (doc?.['family']) {
      familySection = doc['family'] as FamilySection;
    }
  } else {
    try {
      const doc = await ProfileContent.findOne({ userId })
        .select('family')
        .lean();
      if (doc && typeof doc === 'object' && 'family' in doc && doc['family']) {
        familySection = doc['family'] as FamilySection;
      }
    } catch {
      // MongoDB unavailable — treat as missing, all signals → 0
    }
  }

  return encodeFamilySignals(familySection);
}
