/**
 * Smart Shaadi — Webhook Event Persistence + Idempotency.
 *
 * Razorpay sends an `x-razorpay-event-id` header on every webhook. We persist
 * one row per delivery so replays are detected before any side-effect fires.
 *
 * Flow:
 *   recordWebhookEvent → returns { duplicate: boolean, row: webhookEvents }
 *   markProcessed(id) | markFailed(id, error) | markIgnored(id)
 */
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';

export interface RecordedEvent {
  duplicate: boolean;
  id:        string;
  eventId:   string;
  eventType: string;
}

export async function recordWebhookEvent(args: {
  provider?:  string;
  eventId:    string;
  eventType:  string;
  payload:    unknown;
  signature?: string;
}): Promise<RecordedEvent> {
  const provider = args.provider ?? 'razorpay';

  // Insert with ON CONFLICT DO NOTHING — natural dedup on (provider, eventId)
  const inserted = await db
    .insert(schema.webhookEvents)
    .values({
      provider,
      eventId:   args.eventId,
      eventType: args.eventType,
      payload:   args.payload as Record<string, unknown>,
      signature: args.signature ?? null,
      status:    'RECEIVED',
    })
    .onConflictDoNothing({ target: [schema.webhookEvents.provider, schema.webhookEvents.eventId] })
    .returning({ id: schema.webhookEvents.id });

  if (inserted.length > 0) {
    return { duplicate: false, id: inserted[0]!.id, eventId: args.eventId, eventType: args.eventType };
  }

  // Conflict — fetch existing row id
  const [existing] = await db
    .select({ id: schema.webhookEvents.id })
    .from(schema.webhookEvents)
    .where(
      and(
        eq(schema.webhookEvents.provider, provider),
        eq(schema.webhookEvents.eventId, args.eventId),
      ),
    )
    .limit(1);

  return { duplicate: true, id: existing!.id, eventId: args.eventId, eventType: args.eventType };
}

export async function markProcessed(id: string): Promise<void> {
  await db
    .update(schema.webhookEvents)
    .set({ status: 'PROCESSED', processedAt: new Date() })
    .where(eq(schema.webhookEvents.id, id));
}

export async function markFailed(id: string, error: string): Promise<void> {
  await db
    .update(schema.webhookEvents)
    .set({
      status:    'FAILED',
      lastError: error.slice(0, 4000),
      attempts:  sql`${schema.webhookEvents.attempts} + 1`,
    })
    .where(eq(schema.webhookEvents.id, id));
}

export async function markIgnored(id: string): Promise<void> {
  await db
    .update(schema.webhookEvents)
    .set({ status: 'IGNORED', processedAt: new Date() })
    .where(eq(schema.webhookEvents.id, id));
}

export async function listRecentEvents(limit = 50) {
  return db
    .select()
    .from(schema.webhookEvents)
    .orderBy(sql`${schema.webhookEvents.receivedAt} DESC`)
    .limit(limit);
}
