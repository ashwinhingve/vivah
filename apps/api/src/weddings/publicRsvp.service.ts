/**
 * Smart Shaadi — Public RSVP via token (no auth)
 */

import { randomBytes } from 'crypto';
import { eq, and, gt, asc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  rsvpTokens,
  guests,
  guestLists,
  weddings,
  ceremonies,
  rsvpDeadlines,
  rsvpCustomQuestions,
  rsvpCustomAnswers,
  guestCeremonyInvites,
} from '@smartshaadi/db';
import type { PublicRsvpView, RsvpCustomQuestion, RsvpCustomAnswer, GuestCeremonyPref, MealPref, RsvpDeadline } from '@smartshaadi/types';
import type { PublicRsvpUpdateInput } from '@smartshaadi/schemas';
import { logActivity } from './activity.service.js';
import { requireRole } from './access.js';
import { thankYouQueue } from '../infrastructure/redis/queues.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

const TOKEN_TTL_DAYS = 60;

export async function generateTokenForGuest(
  weddingId: string,
  userId: string,
  guestId: string,
): Promise<{ token: string; expiresAt: string }> {
  await requireRole(weddingId, userId, 'EDITOR');

  // Verify guest in wedding
  const [g] = await db.select({ id: guests.id }).from(guests)
    .innerJoin(guestLists, eq(guestLists.id, guests.guestListId))
    .where(and(eq(guests.id, guestId), eq(guestLists.weddingId, weddingId)))
    .limit(1);
  if (!g) throw appErr('Guest not found in this wedding', 'NOT_FOUND', 404);

  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(rsvpTokens).values({ guestId, token, expiresAt })
    .onConflictDoUpdate({
      target: rsvpTokens.guestId,
      set: { token, expiresAt, usedAt: null },
    });

  return { token, expiresAt: expiresAt.toISOString() };
}

export async function getRsvpView(token: string): Promise<PublicRsvpView | null> {
  const [t] = await db.select().from(rsvpTokens)
    .where(and(eq(rsvpTokens.token, token), gt(rsvpTokens.expiresAt, new Date())))
    .limit(1);
  if (!t) return null;

  const [g] = await db.select().from(guests).where(eq(guests.id, t.guestId)).limit(1);
  if (!g) return null;

  const [gl] = await db.select().from(guestLists).where(eq(guestLists.id, g.guestListId)).limit(1);
  if (!gl) return null;

  const [w] = await db.select().from(weddings).where(eq(weddings.id, gl.weddingId)).limit(1);
  if (!w) return null;

  const cers = await db.select({
    id: ceremonies.id, type: ceremonies.type, date: ceremonies.date, venue: ceremonies.venue,
    startTime: ceremonies.startTime, dressCode: ceremonies.dressCode,
  }).from(ceremonies).where(eq(ceremonies.weddingId, w.id));

  const qRows = await db.select().from(rsvpCustomQuestions)
    .where(eq(rsvpCustomQuestions.weddingId, w.id))
    .orderBy(asc(rsvpCustomQuestions.sortOrder));

  const customQuestions: RsvpCustomQuestion[] = qRows.map(q => ({
    id:           q.id,
    weddingId:    q.weddingId,
    questionText: q.questionText,
    questionType: q.questionType,
    choices:      (q.choices as string[] | null) ?? null,
    isRequired:   q.isRequired,
    sortOrder:    q.sortOrder,
    createdAt:    q.createdAt.toISOString(),
  }));

  const aRows = await db.select().from(rsvpCustomAnswers).where(eq(rsvpCustomAnswers.guestId, g.id));
  const customAnswers: RsvpCustomAnswer[] = aRows.map(a => ({
    id:         a.id,
    guestId:    a.guestId,
    questionId: a.questionId,
    answerText: a.answerText ?? null,
    answerBool: a.answerBool ?? null,
    createdAt:  a.createdAt.toISOString(),
  }));

  const cpRows = await db.select().from(guestCeremonyInvites).where(eq(guestCeremonyInvites.guestId, g.id));
  const ceremonyPrefs: GuestCeremonyPref[] = cpRows.map(c => ({
    guestId:    c.guestId,
    ceremonyId: c.ceremonyId,
    attending:  c.rsvpStatus === 'YES' || c.rsvpStatus === 'MAYBE',
    mealPref:   (c.mealPref ?? 'NO_PREFERENCE') as MealPref,
  }));

  const [dRow] = await db.select().from(rsvpDeadlines).where(eq(rsvpDeadlines.weddingId, w.id)).limit(1);
  const deadline: RsvpDeadline | null = dRow ? {
    weddingId:    dRow.weddingId,
    deadline:     dRow.deadline.toISOString(),
    enforced:     dRow.enforced,
    reminderDays: dRow.reminderDays ?? [],
    createdAt:    dRow.createdAt.toISOString(),
    updatedAt:    dRow.updatedAt.toISOString(),
  } : null;

  return {
    guest: {
      id:                  g.id,
      name:                g.name,
      plusOnes:            g.plusOnes,
      plusOneNames:        (g.plusOneNames as string[] | null) ?? [],
      rsvpStatus:          g.rsvpStatus,
      mealPref:            (g.mealPreference !== 'NO_PREFERENCE' ? g.mealPreference : null) as PublicRsvpView['guest']['mealPref'],
      dietaryNotes:        g.dietaryNotes ?? null,
      accessibilityNotes:  g.accessibilityNotes ?? null,
      invitedToCeremonies: g.invitedToCeremonies ?? [],
    },
    wedding: {
      id: w.id, title: w.title ?? null, weddingDate: w.weddingDate ?? null,
      venueName: w.venueName ?? null, venueCity: w.venueCity ?? null,
      brideName: w.brideName ?? null, groomName: w.groomName ?? null,
      primaryColor: w.primaryColor ?? null,
    },
    ceremonies: cers.map(c => ({
      id: c.id, type: c.type, date: c.date ?? null, venue: c.venue ?? null,
      startTime: c.startTime ?? null, dressCode: c.dressCode ?? null,
    })),
    customQuestions,
    ceremonyPrefs,
    customAnswers,
    deadline,
    expiresAt: t.expiresAt.toISOString(),
  };
}

const THANK_YOU_DELAY_MS = 24 * 60 * 60 * 1000;

export async function submitRsvp(
  token: string,
  input: PublicRsvpUpdateInput,
): Promise<{ ok: true }> {
  const [t] = await db.select().from(rsvpTokens)
    .where(and(eq(rsvpTokens.token, token), gt(rsvpTokens.expiresAt, new Date())))
    .limit(1);
  if (!t) throw appErr('Invalid or expired token', 'INVALID_TOKEN', 404);
  if (t.usedAt) throw appErr('RSVP already submitted', 'RSVP_ALREADY_USED', 410);

  // Resolve weddingId for deadline check + activity log
  const [g0] = await db.select({ guestListId: guests.guestListId }).from(guests).where(eq(guests.id, t.guestId)).limit(1);
  if (!g0) throw appErr('Guest not found', 'NOT_FOUND', 404);
  const [gl0] = await db.select({ weddingId: guestLists.weddingId }).from(guestLists).where(eq(guestLists.id, g0.guestListId)).limit(1);
  const weddingId = gl0?.weddingId;

  // Enforce deadline if configured
  if (weddingId) {
    const [d] = await db.select().from(rsvpDeadlines).where(eq(rsvpDeadlines.weddingId, weddingId)).limit(1);
    if (d?.enforced && d.deadline.getTime() < Date.now()) {
      throw appErr('RSVP closed', 'RSVP_CLOSED', 410);
    }
  }

  const updates: Partial<typeof guests.$inferInsert> = {
    rsvpStatus: input.rsvpStatus,
    updatedAt:  new Date(),
  };
  if (input.mealPref !== undefined) updates.mealPreference = input.mealPref;
  if (input.plusOnes !== undefined) updates.plusOnes = input.plusOnes;
  if (input.plusOneNames !== undefined) updates.plusOneNames = input.plusOneNames;
  if (input.dietaryNotes !== undefined) updates.dietaryNotes = input.dietaryNotes;
  if (input.accessibilityNotes !== undefined) updates.accessibilityNotes = input.accessibilityNotes;

  await db.update(guests).set(updates).where(eq(guests.id, t.guestId));
  await db.update(rsvpTokens).set({ usedAt: new Date() }).where(eq(rsvpTokens.id, t.id));

  // Per-ceremony prefs
  if (input.ceremonyPrefs && input.ceremonyPrefs.length > 0) {
    for (const p of input.ceremonyPrefs) {
      const values = {
        guestId:    t.guestId,
        ceremonyId: p.ceremonyId,
        rsvpStatus: p.attending ? 'YES' : 'NO',
        plusOnes:   0,
        mealPref:   p.mealPref ?? 'NO_PREFERENCE',
      };
      await db.insert(guestCeremonyInvites).values(values)
        .onConflictDoUpdate({
          target: [guestCeremonyInvites.guestId, guestCeremonyInvites.ceremonyId],
          set:    { rsvpStatus: values.rsvpStatus, mealPref: values.mealPref, respondedAt: new Date() },
        });
    }
  }

  // Custom answers
  if (input.customAnswers && input.customAnswers.length > 0) {
    for (const a of input.customAnswers) {
      await db.insert(rsvpCustomAnswers).values({
        guestId:    t.guestId,
        questionId: a.questionId,
        answerText: a.answerText ?? null,
        answerBool: a.answerBool ?? null,
      }).onConflictDoUpdate({
        target: [rsvpCustomAnswers.guestId, rsvpCustomAnswers.questionId],
        set:    { answerText: a.answerText ?? null, answerBool: a.answerBool ?? null },
      });
    }
  }

  if (weddingId) {
    await logActivity(weddingId, null, 'rsvp.public.submit', 'guest', t.guestId, {
      rsvpStatus: input.rsvpStatus,
    });

    // Enqueue thank-you 24h after a YES (only fires if still YES then)
    if (input.rsvpStatus === 'YES') {
      try {
        await thankYouQueue.add(
          'thankYou',
          { weddingId, guestId: t.guestId },
          { delay: THANK_YOU_DELAY_MS, jobId: `thank-you:${t.guestId}`, removeOnComplete: true },
        );
      } catch (e) {
        console.warn('[publicRsvp] thank-you enqueue failed:', (e as Error).message);
      }
    }
  }

  return { ok: true };
}
