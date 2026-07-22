/**
 * Referral Credits Ledger tests.
 *
 * Critical test: DOUBLE-SPEND PREVENTION. Two concurrent reserves of 150 credits
 * against a 150-credit balance — exactly one must succeed. This is the atomic
 * INSERT...WHERE pattern that the entire ledger design justifies.
 *
 * These tests run against a REAL Postgres (localhost dev DB) — the double-spend
 * guard lives in a single conditional INSERT and cannot be proven against a mock.
 * Requires migration 0040 to be applied.
 *
 * Each test creates a real `user` row: referral_credits_ledger.user_id carries an
 * FK to user(id), so a synthetic UUID fails on INSERT. (ON DELETE CASCADE governs
 * deletion, not insertion — it does not exempt these rows from the constraint.)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { referralCreditsLedger, user } from '@smartshaadi/db';
import {
  getAvailableCredits,
  reserveCreditsForOrder,
  spendCreditsForOrder,
  releaseCreditsForOrder,
} from '../referralService.js';
import { randomUUID } from 'crypto';

describe('Referral Credits Ledger', () => {
  let testUserId: string;

  beforeEach(async () => {
    testUserId = randomUUID();
    // Real user row — the ledger FK requires it.
    await db.insert(user).values({
      id: testUserId,
      name: 'Ledger Test User',
      email: `ledger-test-${testUserId}@example.test`,
    });
  });

  afterEach(async () => {
    // Ledger rows cascade from the user delete, but remove them explicitly so a
    // failure in the user delete cannot leave orphaned balance behind.
    await db.delete(referralCreditsLedger).where(eq(referralCreditsLedger.userId, testUserId));
    await db.delete(user).where(eq(user.id, testUserId));
  });

  describe('getAvailableCredits', () => {
    it('returns 0 for user with no ledger entries', async () => {
      const credits = await getAvailableCredits(testUserId);
      expect(credits).toBe(0);
    });

    it('sums EARN and SPEND, excludes HOLD', async () => {
      // Insert: EARN +100, HOLD -50, SPEND -30 → expected sum: 100 - 50 - 30 = 20
      await db.insert(referralCreditsLedger).values({
        userId: testUserId,
        amount: 100,
        type: 'EARN',
        relatedId: 'ref_1',
      });

      await db.insert(referralCreditsLedger).values({
        userId: testUserId,
        amount: -50,
        type: 'HOLD',
        relatedId: 'order_1',
      });

      await db.insert(referralCreditsLedger).values({
        userId: testUserId,
        amount: -30,
        type: 'SPEND',
        relatedId: 'order_2',
      });

      const credits = await getAvailableCredits(testUserId);
      expect(credits).toBe(100 - 50 - 30);

      // Cleanup
      await db
        .delete(referralCreditsLedger)
        .where(eq(referralCreditsLedger.userId, testUserId));
    });
  });

  describe('reserveCreditsForOrder', () => {
    it('succeeds when balance is sufficient', async () => {
      await db.insert(referralCreditsLedger).values({
        userId: testUserId,
        amount: 200,
        type: 'EARN',
        relatedId: 'ref_base',
      });

      const ledgerId = await reserveCreditsForOrder(testUserId, 'order_1', 150);
      expect(ledgerId).toBeTruthy();

      const balance = await getAvailableCredits(testUserId);
      expect(balance).toBe(200 - 150);

      await db
        .delete(referralCreditsLedger)
        .where(eq(referralCreditsLedger.userId, testUserId));
    });

    it('fails when balance is insufficient', async () => {
      await db.insert(referralCreditsLedger).values({
        userId: testUserId,
        amount: 100,
        type: 'EARN',
        relatedId: 'ref_low',
      });

      const ledgerId = await reserveCreditsForOrder(testUserId, 'order_fail', 150);
      expect(ledgerId).toBeNull();

      await db
        .delete(referralCreditsLedger)
        .where(eq(referralCreditsLedger.userId, testUserId));
    });

    it('CRITICAL: double-spend prevention — two concurrent reserves of 150 vs 150 balance', async () => {
      // Setup: user has 150 credits
      await db.insert(referralCreditsLedger).values({
        userId: testUserId,
        amount: 150,
        type: 'EARN',
        relatedId: 'ref_race',
      });

      // Simulate two concurrent reserves for different orders
      const [result1, result2] = await Promise.all([
        reserveCreditsForOrder(testUserId, 'order_race_1', 150),
        reserveCreditsForOrder(testUserId, 'order_race_2', 150),
      ]);

      // Exactly one must succeed, one must fail
      const successes = [result1, result2].filter((r) => r != null);
      expect(successes).toHaveLength(1);

      // Balance should reflect only the successful reserve
      const balance = await getAvailableCredits(testUserId);
      expect(balance).toBe(150 - 150);

      await db
        .delete(referralCreditsLedger)
        .where(eq(referralCreditsLedger.userId, testUserId));
    });

    it('idempotent: re-reserving same order returns null without error', async () => {
      await db.insert(referralCreditsLedger).values({
        userId: testUserId,
        amount: 300,
        type: 'EARN',
        relatedId: 'ref_idem',
      });

      const first = await reserveCreditsForOrder(testUserId, 'order_idem', 100);
      expect(first).toBeTruthy();

      // Try to reserve the same order again
      const second = await reserveCreditsForOrder(testUserId, 'order_idem', 100);
      expect(second).toBeNull(); // Idempotent: returns null for conflict

      // Should not have created a duplicate
      const ledgerRows = await db
        .select({ id: referralCreditsLedger.id })
        .from(referralCreditsLedger)
        .where(eq(referralCreditsLedger.userId, testUserId));
      expect(ledgerRows).toHaveLength(2); // EARN + HOLD, not EARN + HOLD + HOLD

      await db
        .delete(referralCreditsLedger)
        .where(eq(referralCreditsLedger.userId, testUserId));
    });
  });

  describe('spendCreditsForOrder', () => {
    it('flips HOLD to SPEND', async () => {
      await db.insert(referralCreditsLedger).values({
        userId: testUserId,
        amount: 200,
        type: 'EARN',
        relatedId: 'ref_spend',
      });

      await reserveCreditsForOrder(testUserId, 'order_spend', 150);

      const spent = await spendCreditsForOrder(testUserId, 'order_spend');
      expect(spent).toBe(true);

      const [row] = await db
        .select()
        .from(referralCreditsLedger)
        .where(eq(referralCreditsLedger.relatedId, 'order_spend'));
      expect(row?.type).toBe('SPEND');
      expect(row?.processedAt).toBeTruthy();

      await db
        .delete(referralCreditsLedger)
        .where(eq(referralCreditsLedger.userId, testUserId));
    });

    it('idempotent: re-spending same order succeeds without error', async () => {
      await db.insert(referralCreditsLedger).values({
        userId: testUserId,
        amount: 200,
        type: 'EARN',
        relatedId: 'ref_spend2',
      });

      await reserveCreditsForOrder(testUserId, 'order_spend2', 100);
      const first = await spendCreditsForOrder(testUserId, 'order_spend2');
      expect(first).toBe(true);

      const second = await spendCreditsForOrder(testUserId, 'order_spend2');
      expect(second).toBe(true); // Idempotent

      await db
        .delete(referralCreditsLedger)
        .where(eq(referralCreditsLedger.userId, testUserId));
    });
  });

  describe('releaseCreditsForOrder', () => {
    it('inserts RELEASE row with positive amount', async () => {
      await db.insert(referralCreditsLedger).values({
        userId: testUserId,
        amount: 200,
        type: 'EARN',
        relatedId: 'ref_release',
      });

      const ledgerId = await reserveCreditsForOrder(testUserId, 'order_release', 150);
      expect(ledgerId).toBeTruthy();

      const released = await releaseCreditsForOrder(testUserId, 'order_release');
      expect(released).toBe(true);

      // HOLD should still exist; RELEASE should be new
      const ledgerRows = await db
        .select()
        .from(referralCreditsLedger)
        .where(eq(referralCreditsLedger.userId, testUserId));

      const holdRow = ledgerRows.find((r) => r.type === 'HOLD');
      const releaseRow = ledgerRows.find((r) => r.type === 'RELEASE');

      expect(holdRow).toBeTruthy();
      expect(releaseRow).toBeTruthy();
      expect(releaseRow?.amount).toBe(150); // Positive, opposite of hold

      await db
        .delete(referralCreditsLedger)
        .where(eq(referralCreditsLedger.userId, testUserId));
    });

    it('idempotent: re-releasing same order succeeds without duplicate', async () => {
      await db.insert(referralCreditsLedger).values({
        userId: testUserId,
        amount: 200,
        type: 'EARN',
        relatedId: 'ref_release2',
      });

      await reserveCreditsForOrder(testUserId, 'order_release2', 100);
      const first = await releaseCreditsForOrder(testUserId, 'order_release2');
      expect(first).toBe(true);

      const second = await releaseCreditsForOrder(testUserId, 'order_release2');
      expect(second).toBe(true); // Idempotent

      const releaseRows = await db
        .select()
        .from(referralCreditsLedger)
        .where(eq(referralCreditsLedger.relatedId, 'order_release2'));
      expect(releaseRows.filter((r) => r.type === 'RELEASE')).toHaveLength(1);

      await db
        .delete(referralCreditsLedger)
        .where(eq(referralCreditsLedger.userId, testUserId));
    });
  });

});
