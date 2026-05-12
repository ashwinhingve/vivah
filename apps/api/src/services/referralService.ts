/**
 * Referral Programme service (Tier 3 Track 1).
 *
 * Each user can have one referral code (created lazily). New signups that
 * apply the code generate a referrals row; when the referred user crosses
 * profile-completion / subscription milestones the service credits the
 * referrer with a numeric `referralCredits` balance on the user table.
 *
 * Reward economy: 50 credits on COMPLETED_PROFILE, 200 credits on SUBSCRIBED.
 * Credits are an in-app currency, NOT real money.
 */
import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { referralCodes, referrals, user } from '@smartshaadi/db';
import { db } from '../lib/db.js';

const CODE_LEN = 8;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COMPLETE_REWARD = 50;
const SUBSCRIBE_REWARD = 200;

export interface ReferralCodeRow {
  id: string;
  code: string;
  usesCount: number;
  isActive: boolean;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface ReferralRow {
  id: string;
  status: string;
  rewardCredited: boolean;
  rewardAmountCredits: number;
  createdAt: Date;
  convertedAt: Date | null;
  referredUserId: string;
  referredName: string | null;
}

export interface ReferralActivity {
  code: ReferralCodeRow | null;
  totalCredits: number;
  referrals: ReferralRow[];
}

function generateCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Idempotent. Returns the user's existing code or creates one. Collision-safe
 * via 3 retries — the alphabet is 32^8 = 1.1T combos, collisions are extremely
 * unlikely but we still loop on the unique index violation.
 */
export async function generateCodeForUser(userId: string): Promise<ReferralCodeRow> {
  const [existing] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.ownerUserId, userId))
    .limit(1);

  if (existing) return toCodeRow(existing);

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    try {
      const [inserted] = await db
        .insert(referralCodes)
        .values({ ownerUserId: userId, code })
        .returning();
      if (inserted) return toCodeRow(inserted);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/unique|duplicate/i.test(msg)) throw e;
    }
  }
  throw new Error('Failed to generate unique referral code after 3 attempts');
}

export async function validateCode(code: string): Promise<ReferralCodeRow | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  const [row] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.code, trimmed))
    .limit(1);
  if (!row || !row.isActive) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
  return toCodeRow(row);
}

/**
 * Records a SIGNED_UP referral. Idempotent on referredUserId — the unique
 * index on `referrals.referred_user_id` means a second call for the same
 * referred user returns null without throwing.
 */
export async function applyCodeAtSignup(
  code: string,
  newUserId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const codeRow = await validateCode(code);
  if (!codeRow) return { ok: false, reason: 'INVALID_CODE' };

  const [owner] = await db
    .select({ id: referralCodes.ownerUserId })
    .from(referralCodes)
    .where(eq(referralCodes.id, codeRow.id))
    .limit(1);
  if (!owner) return { ok: false, reason: 'INVALID_CODE' };
  if (owner.id === newUserId) return { ok: false, reason: 'SELF_REFERRAL' };

  try {
    await db.insert(referrals).values({
      codeId: codeRow.id,
      referrerUserId: owner.id,
      referredUserId: newUserId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) return { ok: false, reason: 'ALREADY_REFERRED' };
    throw e;
  }

  await db
    .update(referralCodes)
    .set({ usesCount: sql`${referralCodes.usesCount} + 1` })
    .where(eq(referralCodes.id, codeRow.id));

  return { ok: true };
}

export async function markReferralComplete(referredUserId: string): Promise<boolean> {
  return creditMilestone(referredUserId, 'COMPLETED_PROFILE', COMPLETE_REWARD);
}

export async function markReferralSubscribed(referredUserId: string): Promise<boolean> {
  return creditMilestone(referredUserId, 'SUBSCRIBED', SUBSCRIBE_REWARD);
}

async function creditMilestone(
  referredUserId: string,
  newStatus: 'COMPLETED_PROFILE' | 'SUBSCRIBED',
  credits: number,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.referredUserId, referredUserId), eq(referrals.rewardCredited, false)))
    .limit(1);
  if (!row) return false;

  await db
    .update(referrals)
    .set({
      status: newStatus,
      rewardCredited: true,
      rewardAmountCredits: credits,
      convertedAt: new Date(),
    })
    .where(eq(referrals.id, row.id));

  await db
    .update(user)
    .set({ referralCredits: sql`${user.referralCredits} + ${credits}` })
    .where(eq(user.id, row.referrerUserId));

  return true;
}

export async function getMyReferralActivity(userId: string): Promise<ReferralActivity> {
  const [code] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.ownerUserId, userId))
    .limit(1);

  const [me] = await db
    .select({ credits: user.referralCredits })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const rows = await db
    .select({
      id:                  referrals.id,
      status:              referrals.status,
      rewardCredited:      referrals.rewardCredited,
      rewardAmountCredits: referrals.rewardAmountCredits,
      createdAt:           referrals.createdAt,
      convertedAt:         referrals.convertedAt,
      referredUserId:      referrals.referredUserId,
      referredName:        user.name,
    })
    .from(referrals)
    .leftJoin(user, eq(referrals.referredUserId, user.id))
    .where(eq(referrals.referrerUserId, userId));

  return {
    code: code ? toCodeRow(code) : null,
    totalCredits: me?.credits ?? 0,
    referrals: rows.map((r) => ({
      id:                  r.id,
      status:              r.status,
      rewardCredited:      r.rewardCredited,
      rewardAmountCredits: r.rewardAmountCredits ?? 0,
      createdAt:           r.createdAt,
      convertedAt:         r.convertedAt,
      referredUserId:      r.referredUserId,
      referredName:        r.referredName,
    })),
  };
}

interface RawCodeRow {
  id: string;
  code: string;
  usesCount: number;
  isActive: boolean;
  createdAt: Date;
  expiresAt: Date | null;
}

function toCodeRow(r: RawCodeRow): ReferralCodeRow {
  return {
    id:        r.id,
    code:      r.code,
    usesCount: r.usesCount,
    isActive:  r.isActive,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  };
}
