/**
 * Smart Shaadi — Family Service (matrimonial side)
 *
 * Handles structured family rows (family_members) + verification badge state
 * + family inclination score. Uses PostgreSQL only — the unstructured family
 * blob lives in MongoDB ProfileContent.family and is owned by content.service.
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  familyMembers,
  familyVerifications,
  profiles,
} from '@smartshaadi/db';
import type {
  FamilyMember,
  FamilyVerification,
  FamilyView,
  FamilyRelationship,
  FamilyVerificationBadge,
  FamilySection,
} from '@smartshaadi/types';
import type {
  AddFamilyMemberInput,
  UpdateFamilyMemberInput,
} from '@smartshaadi/schemas';
import { getMyProfileContent } from './content.service.js';
import { encodeFamilySignals, computeFiiScoreFromSignals } from '../services/fiiScore.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

// ── userId → profileId resolver (Rule 12) ────────────────────────────────────

async function resolveProfileId(userId: string): Promise<string> {
  const [p] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!p) throw appErr('Profile not found', 'NOT_FOUND', 404);
  return p.id;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapMember(r: typeof familyMembers.$inferSelect): FamilyMember {
  const out: FamilyMember = {
    id:            r.id,
    profileId:     r.profileId,
    name:          r.name,
    relationship:  r.relationship as FamilyRelationship,
    isManaging:    r.isManaging,
    managerUserId: r.managerUserId ?? null,
    addedAt:       r.addedAt.toISOString(),
  };
  if (r.phone != null) out.phone = r.phone;
  if (r.email != null) out.email = r.email;
  if (r.notes != null) out.notes = r.notes;
  return out;
}

function mapVerification(r: typeof familyVerifications.$inferSelect): FamilyVerification {
  return {
    profileId:    r.profileId,
    isVerified:   r.isVerified,
    verifiedAt:   r.verifiedAt ? r.verifiedAt.toISOString() : null,
    verifiedBy:   r.verifiedBy ?? null,
    badge:        r.badge as FamilyVerificationBadge,
    createdAt:    r.createdAt.toISOString(),
    updatedAt:    r.updatedAt.toISOString(),
  };
}

// ── Family Members ────────────────────────────────────────────────────────────

export async function listFamilyMembers(userId: string): Promise<FamilyMember[]> {
  const profileId = await resolveProfileId(userId);
  const rows = await db.select().from(familyMembers)
    .where(eq(familyMembers.profileId, profileId))
    .orderBy(desc(familyMembers.addedAt));
  return rows.map(mapMember);
}

export async function addFamilyMember(userId: string, input: AddFamilyMemberInput): Promise<FamilyMember> {
  const profileId = await resolveProfileId(userId);
  const [r] = await db.insert(familyMembers).values({
    profileId,
    name:          input.name,
    relationship:  input.relationship,
    isManaging:    input.isManaging ?? false,
    managerUserId: input.isManaging ? userId : null,
    phone:         input.phone ?? null,
    email:         input.email ?? null,
    notes:         input.notes ?? null,
  }).returning();
  if (!r) throw new Error('Failed to add family member');
  return mapMember(r);
}

export async function updateFamilyMember(
  userId: string, memberId: string, input: UpdateFamilyMemberInput,
): Promise<FamilyMember> {
  const profileId = await resolveProfileId(userId);
  const data: Partial<typeof familyMembers.$inferInsert> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.relationship !== undefined) data.relationship = input.relationship;
  if (input.isManaging !== undefined) {
    data.isManaging = input.isManaging;
    data.managerUserId = input.isManaging ? userId : null;
  }
  if (input.phone !== undefined) data.phone = input.phone ?? null;
  if (input.email !== undefined) data.email = input.email ?? null;
  if (input.notes !== undefined) data.notes = input.notes ?? null;

  // Use both id + profileId in WHERE so a forged memberId can never escape
  const updated = await db.update(familyMembers).set(data)
    .where(eq(familyMembers.id, memberId))
    .returning();
  const r = updated.find(x => x.profileId === profileId);
  if (!r) throw appErr('Family member not found', 'NOT_FOUND', 404);
  return mapMember(r);
}

export async function removeFamilyMember(userId: string, memberId: string): Promise<void> {
  const profileId = await resolveProfileId(userId);
  // Fetch first to confirm ownership before delete
  const [existing] = await db.select().from(familyMembers).where(eq(familyMembers.id, memberId)).limit(1);
  if (!existing || existing.profileId !== profileId) throw appErr('Family member not found', 'NOT_FOUND', 404);
  await db.delete(familyMembers).where(eq(familyMembers.id, memberId));
}

// ── Verification ──────────────────────────────────────────────────────────────

export async function getFamilyVerification(userId: string): Promise<FamilyVerification | null> {
  const profileId = await resolveProfileId(userId);
  const [r] = await db.select().from(familyVerifications)
    .where(eq(familyVerifications.profileId, profileId)).limit(1);
  return r ? mapVerification(r) : null;
}

export async function requestFamilyVerification(userId: string): Promise<FamilyVerification> {
  const profileId = await resolveProfileId(userId);
  // Upsert with status PENDING (badge stays NONE until admin approves)
  const values = {
    profileId,
    isVerified: false,
    badge:      'NONE' as const,
    updatedAt:  new Date(),
  };
  const [r] = await db.insert(familyVerifications).values(values)
    .onConflictDoUpdate({ target: familyVerifications.profileId, set: { updatedAt: values.updatedAt } })
    .returning();
  if (!r) throw new Error('Failed to record verification request');
  return mapVerification(r);
}

// ── Family Inclination Score ──────────────────────────────────────────────────

/**
 * Family Inclination Index (FII) scorer — 0-100 integer.
 *
 * Replaces the old completeness heuristic with a 7-signal weighted score
 * measuring the user's family-life inclination (not profile completeness).
 *
 * Weights (must sum to 1.00):
 *   family_type_preference    0.20
 *   family_values_orientation 0.15
 *   parents_living_intent     0.18
 *   family_decisions          0.15
 *   cultural_events           0.12
 *   siblings_engagement       0.07
 *   religious_practice        0.13
 *
 * Null/missing fields contribute 0 to the weighted sum (NOT a default of 50).
 * The memberCount parameter is kept for signature compatibility but unused.
 */
export function scoreFamilySection(section: FamilySection | null | undefined, _memberCount: number): number {
  const signals = encodeFamilySignals(section);
  return computeFiiScoreFromSignals(signals);
}

export async function computeFamilyInclinationScore(userId: string): Promise<number> {
  const profileId = await resolveProfileId(userId);
  const content = await getMyProfileContent(userId);
  const section = (content?.family ?? null) as FamilySection | null;
  const members = await db.select({ id: familyMembers.id }).from(familyMembers)
    .where(eq(familyMembers.profileId, profileId));
  const score = scoreFamilySection(section, members.length);
  await db.update(profiles).set({ familyInclinationScore: score }).where(eq(profiles.id, profileId));
  return score;
}

// ── Composite view ────────────────────────────────────────────────────────────

export async function getFamilyView(userId: string): Promise<FamilyView> {
  const profileId = await resolveProfileId(userId);
  const [verification, members, content, profileRow] = await Promise.all([
    getFamilyVerification(userId),
    listFamilyMembers(userId),
    getMyProfileContent(userId),
    db.select({ score: profiles.familyInclinationScore }).from(profiles).where(eq(profiles.id, profileId)).limit(1),
  ]);

  return {
    section:          (content?.family ?? {}) as FamilySection,
    members,
    verification,
    inclinationScore: profileRow[0]?.score ?? null,
  };
}
