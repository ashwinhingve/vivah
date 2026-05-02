/**
 * Smart Shaadi — Guest Extra Services
 *
 * Address, per-ceremony prefs, custom RSVP questions, RSVP deadline.
 * Each service follows the same wedding-owner gate pattern.
 */

import { eq, and, asc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  guests, guestLists, weddings, profiles, ceremonies,
  guestAddresses, guestCeremonyInvites,
  rsvpCustomQuestions, rsvpCustomAnswers,
  rsvpDeadlines,
} from '@smartshaadi/db';
import type {
  GuestAddress, GuestCeremonyPref, RsvpCustomQuestion, RsvpDeadline, MealPref,
} from '@smartshaadi/types';
import type {
  UpsertGuestAddressInput, UpsertCeremonyPrefsInput,
  AddRsvpQuestionInput, UpdateRsvpQuestionInput,
  UpsertRsvpDeadlineInput,
} from '@smartshaadi/schemas';
import { logActivity } from '../weddings/activity.service.js';
import { rsvpReminderQueue } from '../infrastructure/redis/queues.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

async function gateOwner(weddingId: string, userId: string): Promise<void> {
  const [w] = await db.select({ profileId: weddings.profileId }).from(weddings)
    .where(eq(weddings.id, weddingId)).limit(1);
  if (!w) throw appErr('Wedding not found', 'NOT_FOUND', 404);
  const [p] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!p || w.profileId !== p.id) throw appErr('Forbidden', 'FORBIDDEN', 403);
}

async function assertGuestInWedding(weddingId: string, guestId: string): Promise<void> {
  const [row] = await db
    .select({ id: guests.id })
    .from(guests)
    .innerJoin(guestLists, eq(guestLists.id, guests.guestListId))
    .where(and(eq(guests.id, guestId), eq(guestLists.weddingId, weddingId)))
    .limit(1);
  if (!row) throw appErr('Guest not found in this wedding', 'NOT_FOUND', 404);
}

// ── Guest Address ─────────────────────────────────────────────────────────────

export async function getGuestAddress(weddingId: string, guestId: string, userId: string): Promise<GuestAddress | null> {
  await gateOwner(weddingId, userId);
  await assertGuestInWedding(weddingId, guestId);
  const [a] = await db.select().from(guestAddresses).where(eq(guestAddresses.guestId, guestId)).limit(1);
  if (!a) return null;
  return {
    guestId:   a.guestId,
    line1:     a.line1 ?? null,
    line2:     a.line2 ?? null,
    city:      a.city ?? null,
    state:     a.state ?? null,
    pincode:   a.pincode ?? null,
    country:   a.country,
    updatedAt: a.updatedAt.toISOString(),
  };
}

export async function upsertGuestAddress(
  weddingId: string,
  guestId: string,
  userId: string,
  input: UpsertGuestAddressInput,
): Promise<GuestAddress> {
  await gateOwner(weddingId, userId);
  await assertGuestInWedding(weddingId, guestId);

  const values = {
    guestId,
    line1:   input.line1 ?? null,
    line2:   input.line2 ?? null,
    city:    input.city ?? null,
    state:   input.state ?? null,
    pincode: input.pincode ?? null,
    country: input.country ?? 'India',
    updatedAt: new Date(),
  };

  const [a] = await db.insert(guestAddresses).values(values)
    .onConflictDoUpdate({ target: guestAddresses.guestId, set: values })
    .returning();
  if (!a) throw new Error('Failed to upsert address');

  await logActivity(weddingId, userId, 'guest.address.upsert', 'guest', guestId);
  return {
    guestId:   a.guestId,
    line1:     a.line1 ?? null,
    line2:     a.line2 ?? null,
    city:      a.city ?? null,
    state:     a.state ?? null,
    pincode:   a.pincode ?? null,
    country:   a.country,
    updatedAt: a.updatedAt.toISOString(),
  };
}

// ── Per-Ceremony Prefs ────────────────────────────────────────────────────────

export async function getGuestCeremonyPrefs(
  weddingId: string,
  guestId: string,
  userId: string,
): Promise<GuestCeremonyPref[]> {
  await gateOwner(weddingId, userId);
  await assertGuestInWedding(weddingId, guestId);

  const rows = await db.select().from(guestCeremonyInvites).where(eq(guestCeremonyInvites.guestId, guestId));
  return rows.map(r => ({
    guestId:    r.guestId,
    ceremonyId: r.ceremonyId,
    attending:  r.rsvpStatus === 'YES' || r.rsvpStatus === 'MAYBE',
    mealPref:   (r.mealPref ?? 'NO_PREFERENCE') as MealPref,
  }));
}

export async function upsertGuestCeremonyPrefs(
  weddingId: string,
  guestId: string,
  userId: string,
  input: UpsertCeremonyPrefsInput,
): Promise<GuestCeremonyPref[]> {
  await gateOwner(weddingId, userId);
  await assertGuestInWedding(weddingId, guestId);

  // Validate all ceremonyIds belong to this wedding
  const cers = await db.select({ id: ceremonies.id }).from(ceremonies).where(eq(ceremonies.weddingId, weddingId));
  const validSet = new Set(cers.map(c => c.id));
  for (const p of input.prefs) {
    if (!validSet.has(p.ceremonyId)) throw appErr('Ceremony not in this wedding', 'NOT_FOUND', 404);
  }

  for (const p of input.prefs) {
    const values = {
      guestId,
      ceremonyId: p.ceremonyId,
      rsvpStatus: p.attending ? 'YES' : 'NO',
      plusOnes:   0,
      mealPref:   p.mealPref ?? 'NO_PREFERENCE',
    };
    await db.insert(guestCeremonyInvites).values(values)
      .onConflictDoUpdate({
        target: [guestCeremonyInvites.guestId, guestCeremonyInvites.ceremonyId],
        set:    { rsvpStatus: values.rsvpStatus, mealPref: values.mealPref },
      });
  }

  await logActivity(weddingId, userId, 'guest.ceremonyPrefs.upsert', 'guest', guestId, { count: input.prefs.length });
  return getGuestCeremonyPrefs(weddingId, guestId, userId);
}

// ── Custom RSVP Questions ─────────────────────────────────────────────────────

function mapQuestion(r: typeof rsvpCustomQuestions.$inferSelect): RsvpCustomQuestion {
  return {
    id:           r.id,
    weddingId:    r.weddingId,
    questionText: r.questionText,
    questionType: r.questionType,
    choices:      (r.choices as string[] | null) ?? null,
    isRequired:   r.isRequired,
    sortOrder:    r.sortOrder,
    createdAt:    r.createdAt.toISOString(),
  };
}

export async function listRsvpQuestions(weddingId: string, userId: string): Promise<RsvpCustomQuestion[]> {
  await gateOwner(weddingId, userId);
  const rows = await db.select().from(rsvpCustomQuestions)
    .where(eq(rsvpCustomQuestions.weddingId, weddingId))
    .orderBy(asc(rsvpCustomQuestions.sortOrder));
  return rows.map(mapQuestion);
}

export async function addRsvpQuestion(
  weddingId: string, userId: string, input: AddRsvpQuestionInput,
): Promise<RsvpCustomQuestion> {
  await gateOwner(weddingId, userId);
  const [r] = await db.insert(rsvpCustomQuestions).values({
    weddingId,
    questionText: input.questionText,
    questionType: input.questionType,
    choices:      input.choices ?? null,
    isRequired:   input.isRequired ?? false,
    sortOrder:    input.sortOrder ?? 0,
  }).returning();
  if (!r) throw new Error('Failed to add question');
  await logActivity(weddingId, userId, 'rsvpQuestion.add', 'question', r.id);
  return mapQuestion(r);
}

export async function updateRsvpQuestion(
  weddingId: string, qId: string, userId: string, input: UpdateRsvpQuestionInput,
): Promise<RsvpCustomQuestion> {
  await gateOwner(weddingId, userId);
  const data: Partial<typeof rsvpCustomQuestions.$inferInsert> = {};
  if (input.questionText !== undefined) data.questionText = input.questionText;
  if (input.questionType !== undefined) data.questionType = input.questionType;
  if (input.choices !== undefined) data.choices = input.choices;
  if (input.isRequired !== undefined) data.isRequired = input.isRequired;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  const [r] = await db.update(rsvpCustomQuestions).set(data)
    .where(and(eq(rsvpCustomQuestions.id, qId), eq(rsvpCustomQuestions.weddingId, weddingId)))
    .returning();
  if (!r) throw appErr('Question not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'rsvpQuestion.update', 'question', qId);
  return mapQuestion(r);
}

export async function deleteRsvpQuestion(weddingId: string, qId: string, userId: string): Promise<void> {
  await gateOwner(weddingId, userId);
  const result = await db.delete(rsvpCustomQuestions)
    .where(and(eq(rsvpCustomQuestions.id, qId), eq(rsvpCustomQuestions.weddingId, weddingId)))
    .returning({ id: rsvpCustomQuestions.id });
  if (result.length === 0) throw appErr('Question not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'rsvpQuestion.delete', 'question', qId);
}

// ── RSVP Deadline ─────────────────────────────────────────────────────────────

function mapDeadline(r: typeof rsvpDeadlines.$inferSelect): RsvpDeadline {
  return {
    weddingId:    r.weddingId,
    deadline:     r.deadline.toISOString(),
    enforced:     r.enforced,
    reminderDays: r.reminderDays ?? [],
    createdAt:    r.createdAt.toISOString(),
    updatedAt:    r.updatedAt.toISOString(),
  };
}

export async function getRsvpDeadline(weddingId: string, userId: string): Promise<RsvpDeadline | null> {
  await gateOwner(weddingId, userId);
  const [r] = await db.select().from(rsvpDeadlines).where(eq(rsvpDeadlines.weddingId, weddingId)).limit(1);
  return r ? mapDeadline(r) : null;
}

export async function upsertRsvpDeadline(
  weddingId: string, userId: string, input: UpsertRsvpDeadlineInput,
): Promise<RsvpDeadline> {
  await gateOwner(weddingId, userId);
  const values = {
    weddingId,
    deadline:     new Date(input.deadline),
    enforced:     input.enforced ?? false,
    reminderDays: input.reminderDays ?? [7, 3, 1],
    updatedAt:    new Date(),
  };

  const [r] = await db.insert(rsvpDeadlines).values(values)
    .onConflictDoUpdate({
      target: rsvpDeadlines.weddingId,
      set: { deadline: values.deadline, enforced: values.enforced, reminderDays: values.reminderDays, updatedAt: values.updatedAt },
    })
    .returning();
  if (!r) throw new Error('Failed to upsert deadline');

  // Schedule reminders for each reminderDays offset (mock-safe — queue is in-memory in mock)
  try {
    for (const days of values.reminderDays) {
      const delayMs = values.deadline.getTime() - days * 24 * 60 * 60 * 1000 - Date.now();
      if (delayMs <= 0) continue;
      await rsvpReminderQueue.add(
        'rsvpReminder',
        { weddingId, daysBefore: days },
        { delay: delayMs, jobId: `rsvp-reminder:${weddingId}:${days}`, removeOnComplete: true },
      );
    }
  } catch (e) {
    // Queue may not be available in every env (e.g. tests). Don't fail.
    console.warn('[rsvp-deadline] failed to schedule reminders:', (e as Error).message);
  }

  await logActivity(weddingId, userId, 'rsvpDeadline.upsert', 'wedding', weddingId, { deadline: input.deadline, enforced: values.enforced });
  return mapDeadline(r);
}

// ── Custom Answers (used by public RSVP submit) ──────────────────────────────

export async function writeCustomAnswers(
  guestId: string,
  answers: Array<{ questionId: string; answerText?: string; answerBool?: boolean }>,
): Promise<void> {
  for (const a of answers) {
    await db.insert(rsvpCustomAnswers).values({
      guestId,
      questionId: a.questionId,
      answerText: a.answerText ?? null,
      answerBool: a.answerBool ?? null,
    }).onConflictDoUpdate({
      target: [rsvpCustomAnswers.guestId, rsvpCustomAnswers.questionId],
      set:    { answerText: a.answerText ?? null, answerBool: a.answerBool ?? null },
    });
  }
}

export async function getCustomAnswersForGuest(guestId: string): Promise<Array<{ id: string; questionId: string; answerText: string | null; answerBool: boolean | null }>> {
  const rows = await db.select().from(rsvpCustomAnswers).where(eq(rsvpCustomAnswers.guestId, guestId));
  return rows.map(r => ({
    id:         r.id,
    questionId: r.questionId,
    answerText: r.answerText ?? null,
    answerBool: r.answerBool ?? null,
  }));
}
