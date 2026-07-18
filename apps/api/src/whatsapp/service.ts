/**
 * Smart Shaadi — WhatsApp Business service (Unit 6.1, Tier 2)
 *
 * Persists each outbound template message and ENQUEUES the send via Bull — the
 * provider is never called synchronously in a request handler (Rule 8). The
 * worker (jobs/whatsappWorker.ts) drains the queue and calls the provider.
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { whatsappMessages } from '@smartshaadi/db';
import { shouldUseMockWhatsApp } from '../lib/env.js';
import { whatsappQueue, DEFAULT_JOB_OPTS } from '../infrastructure/redis/queues.js';
import { sendTemplate } from './provider.js';
import type { WhatsAppSendResult } from '@smartshaadi/types';

export class WhatsAppError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'WhatsAppError';
  }
}

export interface QueueWhatsAppInput {
  profileId?: string | null;
  toPhone:    string;
  template:   string;
  params?:    Record<string, string | number> | undefined;
}

/**
 * Persist an outbound message row (QUEUED) and enqueue its send. Returns
 * immediately — the actual provider call happens on the worker. `mock` records
 * whether this send will hit the real provider or the stub, for audit.
 */
export async function queueWhatsAppMessage(input: QueueWhatsAppInput): Promise<WhatsAppSendResult> {
  const [row] = await db
    .insert(whatsappMessages)
    .values({
      profileId: input.profileId ?? null,
      toPhone:   input.toPhone,
      template:  input.template,
      params:    input.params ?? null,
      status:    'QUEUED',
      mock:      shouldUseMockWhatsApp,
    })
    .returning();

  if (!row) throw new WhatsAppError('INSERT_FAILED', 'Could not persist WhatsApp message');

  await whatsappQueue.add('send', { messageId: row.id }, { jobId: `wa-${row.id}`, ...DEFAULT_JOB_OPTS });

  return { id: row.id, status: 'QUEUED', providerRef: null, mock: row.mock };
}

/**
 * Worker entrypoint — send one persisted message and record the outcome.
 * MOCKED when the provider stub returns (mock mode); SENT on a real send;
 * FAILED (and rethrown for Bull retry) on error.
 */
export async function processWhatsAppMessage(messageId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.id, messageId))
    .limit(1);

  if (!row) throw new WhatsAppError('NOT_FOUND', `WhatsApp message ${messageId} not found`);

  try {
    const result = await sendTemplate({
      toPhone:  row.toPhone,
      template: row.template,
      params:   (row.params as Record<string, string | number> | null) ?? undefined,
    });
    await db
      .update(whatsappMessages)
      .set({ status: result.mock ? 'MOCKED' : 'SENT', providerRef: result.providerRef, updatedAt: new Date() })
      .where(eq(whatsappMessages.id, messageId));
  } catch (e) {
    await db
      .update(whatsappMessages)
      .set({ status: 'FAILED', error: (e as Error).message, updatedAt: new Date() })
      .where(eq(whatsappMessages.id, messageId));
    throw e;
  }
}

/** Recent outbound messages for one profile (own-data scoped). */
export async function listWhatsAppMessages(profileId: string, limit = 100) {
  return db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.profileId, profileId))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(limit);
}

/** Recent outbound messages across all profiles — admin/ops view only. */
export async function listRecentWhatsAppMessages(limit = 100) {
  return db
    .select()
    .from(whatsappMessages)
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(limit);
}
