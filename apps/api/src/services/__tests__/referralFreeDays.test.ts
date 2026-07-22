/**
 * Free-days redemption tests.
 *
 * Credits are redeemed as days appended to the billing period rather than as a
 * checkout discount, because Razorpay Subscriptions cannot express a per-user
 * dynamic discount. Redemption therefore runs AFTER payment succeeds, which is
 * what removes the refund path entirely — these tests pin that contract.
 *
 * Runs against a real Postgres (migration 0040 required).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../../lib/db.js';
import { referralCreditsLedger, user } from '@smartshaadi/db';
import { redeemCreditsAsFreeDays, getAvailableCredits } from '../referralService.js';

// Standard Monthly: ₹499 over 30 days ≈ ₹16.63/day.
const STANDARD_MONTHLY = 499;
const MONTH_DAYS = 30;

describe('redeemCreditsAsFreeDays', () => {
  let userId: string;

  beforeEach(async () => {
    userId = randomUUID();
    await db.insert(user).values({
      id: userId,
      name: 'Free Days Test User',
      email: `freedays-${userId}@example.test`,
    });
  });

  afterEach(async () => {
    await db.delete(referralCreditsLedger).where(eq(referralCreditsLedger.userId, userId));
    await db.delete(user).where(eq(user.id, userId));
  });

  async function earn(credits: number, ref: string) {
    await db.insert(referralCreditsLedger).values({
      userId, amount: credits, type: 'EARN', relatedId: ref,
    });
  }

  it('grants zero days when the balance is empty', async () => {
    const result = await redeemCreditsAsFreeDays(userId, 'sub_1', STANDARD_MONTHLY, MONTH_DAYS);
    expect(result).toEqual({ daysGranted: 0, creditsSpent: 0 });
  });

  it('grants zero days when the balance cannot buy a whole day', async () => {
    await earn(10, 'ref_small'); // ₹10 < ₹16.63/day
    const result = await redeemCreditsAsFreeDays(userId, 'sub_2', STANDARD_MONTHLY, MONTH_DAYS);
    expect(result.daysGranted).toBe(0);
    // Credits must survive an unsuccessful redemption.
    expect(await getAvailableCredits(userId)).toBe(10);
  });

  it('converts a full referral (250 credits) into 15 days at the plan daily rate', async () => {
    await earn(250, 'ref_full');
    const result = await redeemCreditsAsFreeDays(userId, 'sub_3', STANDARD_MONTHLY, MONTH_DAYS);
    expect(result.daysGranted).toBe(15); // floor(250 / 16.63)
    expect(result.creditsSpent).toBeLessThanOrEqual(250);
  });

  it('leaves the part-day remainder spendable instead of burning it', async () => {
    await earn(250, 'ref_remainder');
    const { creditsSpent } = await redeemCreditsAsFreeDays(
      userId, 'sub_4', STANDARD_MONTHLY, MONTH_DAYS,
    );
    const remaining = await getAvailableCredits(userId);
    expect(remaining).toBe(250 - creditsSpent);
    expect(remaining).toBeGreaterThan(0); // 250 is not an exact multiple of the daily rate
  });

  it('is idempotent per subscription — a webhook redelivery grants no second batch', async () => {
    await earn(250, 'ref_idem');
    const first = await redeemCreditsAsFreeDays(userId, 'sub_5', STANDARD_MONTHLY, MONTH_DAYS);
    expect(first.daysGranted).toBe(15);

    const balanceAfterFirst = await getAvailableCredits(userId);

    // Razorpay retries subscription.activated; this must not grant days again.
    const second = await redeemCreditsAsFreeDays(userId, 'sub_5', STANDARD_MONTHLY, MONTH_DAYS);
    expect(second.daysGranted).toBe(0);
    expect(await getAvailableCredits(userId)).toBe(balanceAfterFirst);
  });

  it('values a credit equally across plans (premium buys proportionally fewer days)', async () => {
    await earn(999, 'ref_premium');
    // Premium Monthly ₹999/30d = ₹33.30/day → 999 credits buys exactly ~30 days.
    const result = await redeemCreditsAsFreeDays(userId, 'sub_6', 999, MONTH_DAYS);
    expect(result.daysGranted).toBe(30);
  });

  it('refuses nonsensical plan inputs rather than granting free service', async () => {
    await earn(250, 'ref_guard');
    expect(await redeemCreditsAsFreeDays(userId, 'sub_7', 0, MONTH_DAYS))
      .toEqual({ daysGranted: 0, creditsSpent: 0 });
    expect(await redeemCreditsAsFreeDays(userId, 'sub_8', STANDARD_MONTHLY, 0))
      .toEqual({ daysGranted: 0, creditsSpent: 0 });
    expect(await getAvailableCredits(userId)).toBe(250);
  });
});
