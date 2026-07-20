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
import { referralCodes, referrals, user, referralCreditsLedger } from '@smartshaadi/db';
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
 * Credit ledger operations for atomic, auditable credit holds and spends.
 * CRITICAL: All operations use conditional INSERT or explicit row matching
 * to prevent TOCTOU races and double-spending.
 */

/**
 * Normalise a `db.execute()` result to the returned rows.
 *
 * drizzle's node-postgres driver resolves to a pg `QueryResult` — the rows are
 * on `.rows`, and the result itself has no `.length`. Reading `.length` directly
 * yields undefined, which is falsy, so every RETURNING-based guard below would
 * silently report "no rows" and the operation would look like it failed while
 * having actually written. Other call sites in this repo (see
 * jobs/historicalAttendanceJob.ts) hedge across both shapes; do the same here.
 */
function executedRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function getAvailableCredits(userId: string): Promise<number> {
  // Raw SQL query to atomically SUM all amounts for the user.
  const rows = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(referralCreditsLedger)
    .where(eq(referralCreditsLedger.userId, userId));
  return Number(rows[0]?.total ?? 0);
}

/**
 * Atomically reserve credits for an order. Returns the ledger row ID if successful,
 * null if insufficient balance or if a hold for this order already exists.
 * Idempotent on (user_id, 'HOLD', related_id) — re-reservation returns existing hold.
 */
export async function reserveCreditsForOrder(
  userId: string,
  orderId: string,
  credits: number,
): Promise<string | null> {
  if (credits <= 0) return null;

  // TOCTOU-safe: atomic INSERT...SELECT with balance check in WHERE clause.
  // Uses PostgreSQL's UPSERT with ON CONFLICT to handle idempotency.
  const rows = executedRows<{ id: string }>(
    await db.execute(
      sql`INSERT INTO referral_credits_ledger (user_id, amount, type, related_entity, related_id, description)
          SELECT ${userId}, ${-credits}, 'HOLD', 'razorpay_subscription', ${orderId}, ${'Reserve for order ' + orderId}
          WHERE (SELECT COALESCE(SUM(amount), 0) FROM referral_credits_ledger WHERE user_id = ${userId}) >= ${credits}
          ON CONFLICT (user_id, type, related_id) DO NOTHING
          RETURNING id`,
    ),
  );

  if (rows.length > 0) return rows[0]!.id;

  // Check if the conflict was due to pre-existing hold (idempotent) or insufficient balance.
  const existing = await db
    .select({ id: referralCreditsLedger.id })
    .from(referralCreditsLedger)
    .where(
      and(
        eq(referralCreditsLedger.userId, userId),
        eq(referralCreditsLedger.type, 'HOLD'),
        eq(referralCreditsLedger.relatedId, orderId),
      ),
    )
    .limit(1);

  if (existing.length > 0) return null; // Conflict: pre-existing hold (idempotent)
  return null; // Conflict: insufficient balance
}

/**
 * Spend reserved credits by flipping the HOLD row's type to SPEND and setting processed_at.
 * Idempotent — if already spent, returns true without error.
 */
export async function spendCreditsForOrder(
  userId: string,
  orderId: string,
): Promise<boolean> {
  const rows = executedRows<{ id: string }>(
    await db.execute(
      sql`UPDATE referral_credits_ledger
          SET type = 'SPEND', processed_at = NOW()
          WHERE user_id = ${userId} AND type = 'HOLD' AND related_id = ${orderId}
          RETURNING id`,
    ),
  );

  if (rows.length > 0) return true;

  // Zero rows updated means either "no such hold" or "already spent". These are
  // different outcomes and must not collapse into failure: Razorpay retries
  // webhooks, so a second delivery for an already-spent order is the normal
  // case, and returning false there would read as a spend failure and alert.
  // Idempotency is about the terminal state, not about who wrote the row.
  const settled = await db
    .select({ id: referralCreditsLedger.id })
    .from(referralCreditsLedger)
    .where(
      and(
        eq(referralCreditsLedger.userId, userId),
        eq(referralCreditsLedger.type, 'SPEND'),
        eq(referralCreditsLedger.relatedId, orderId),
      ),
    )
    .limit(1);

  return settled.length > 0;
}

/**
 * Release reserved credits by inserting a balancing RELEASE row.
 * Idempotent on (user_id, 'RELEASE', related_id) — re-release is a no-op.
 */
export async function releaseCreditsForOrder(
  userId: string,
  orderId: string,
): Promise<boolean> {
  // Find the HOLD amount to release
  const heldRows = await db
    .select({ credits: sql<number>`ABS(amount)` })
    .from(referralCreditsLedger)
    .where(
      and(
        eq(referralCreditsLedger.userId, userId),
        eq(referralCreditsLedger.type, 'HOLD'),
        eq(referralCreditsLedger.relatedId, orderId),
      ),
    )
    .limit(1);

  if (heldRows.length === 0) return false; // No hold to release

  const credits = Number(heldRows[0]!.credits);

  const rows = executedRows<{ id: string }>(
    await db.execute(
      sql`INSERT INTO referral_credits_ledger (user_id, amount, type, related_entity, related_id, description)
          VALUES (${userId}, ${credits}, 'RELEASE', 'razorpay_subscription', ${orderId}, ${'Release order ' + orderId})
          ON CONFLICT (user_id, type, related_id) DO NOTHING
          RETURNING id`,
    ),
  );

  if (rows.length > 0) return true;

  // DO NOTHING fired: a RELEASE for this order already exists. That is the
  // idempotent re-delivery case (payment-failed webhooks retry), not a failure
  // — the credits are already back. Confirm the terminal state and report it.
  const released = await db
    .select({ id: referralCreditsLedger.id })
    .from(referralCreditsLedger)
    .where(
      and(
        eq(referralCreditsLedger.userId, userId),
        eq(referralCreditsLedger.type, 'RELEASE'),
        eq(referralCreditsLedger.relatedId, orderId),
      ),
    )
    .limit(1);

  return released.length > 0;
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

  // Update referral milestone status
  await db
    .update(referrals)
    .set({
      status: newStatus,
      rewardCredited: true,
      rewardAmountCredits: credits,
      convertedAt: new Date(),
    })
    .where(eq(referrals.id, row.id));

  // Write EARN ledger row (idempotent on related_id)
  await db
    .insert(referralCreditsLedger)
    .values({
      userId: row.referrerUserId,
      amount: credits,
      type: 'EARN',
      relatedEntity: 'referral',
      relatedId: row.id,
      description: `${newStatus} reward for referred user`,
    })
    .onConflictDoNothing();

  // Refresh the denormalised cache FROM the ledger rather than incrementing it.
  //
  // The EARN insert above is onConflictDoNothing, so a repeated milestone writes
  // no second row — but a blind `referralCredits + credits` would still increment
  // every time, drifting the cached balance above the ledger truth. Spending stays
  // safe either way (getAvailableCredits reads the ledger), but the user would see
  // a balance they cannot spend. Deriving the value makes the cache self-healing:
  // any past drift is corrected on the next milestone.
  const balance = await getAvailableCredits(row.referrerUserId);
  await db
    .update(user)
    .set({ referralCredits: balance })
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

/**
 * Redeem accumulated credits as free days appended to an active subscription.
 *
 * Razorpay Subscriptions cannot apply a per-user dynamic discount — discounts go
 * through pre-created fixed Offers, which cannot express "this user holds 250
 * credits". So credits are never applied at checkout: the user pays full price and
 * redemption extends the billing period AFTER payment has already succeeded. That
 * ordering is the point — there is no window in which credits are consumed against
 * a payment that might still fail, so this needs no refund path and no
 * abandoned-checkout expiry sweep.
 *
 * Conversion: 1 credit = 1 rupee, converted to days at the plan's own daily rate,
 * so a credit is worth the same to a Standard and a Premium subscriber. Days are
 * floored and only the credits those whole days cost are spent — the remainder
 * stays on the balance rather than being silently burnt on a part-day.
 *
 * Idempotent per subscription via the ledger's (user_id, type, related_id) key.
 */
export async function redeemCreditsAsFreeDays(
  userId: string,
  subscriptionId: string,
  planAmountInr: number,
  periodDays: number,
): Promise<{ daysGranted: number; creditsSpent: number }> {
  const none = { daysGranted: 0, creditsSpent: 0 };
  if (planAmountInr <= 0 || periodDays <= 0) return none;

  const balance = await getAvailableCredits(userId);
  if (balance <= 0) return none;

  const perDay = planAmountInr / periodDays;
  const daysGranted = Math.floor(balance / perDay);
  if (daysGranted < 1) return none;

  // Floor, not round: rounding up can bill more credits than the granted days are
  // actually worth (15d × ₹16.63 = 249.5 → 250). For a rewards currency the
  // rounding error must fall in the user's favour, never the platform's.
  const creditsSpent = Math.floor(daysGranted * perDay);
  const orderKey = `freedays_${subscriptionId}`;

  const reserved = await reserveCreditsForOrder(userId, orderKey, creditsSpent);
  if (reserved === null) return none; // insufficient balance, or already redeemed

  const spent = await spendCreditsForOrder(userId, orderKey);
  if (!spent) {
    // Could not settle the hold — hand the credits back rather than stranding them.
    await releaseCreditsForOrder(userId, orderKey);
    return none;
  }

  await db
    .update(user)
    .set({ referralCredits: await getAvailableCredits(userId) })
    .where(eq(user.id, userId));

  return { daysGranted, creditsSpent };
}
