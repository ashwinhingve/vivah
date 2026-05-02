/**
 * Smart Shaadi — RSVP Analytics
 *
 * Aggregates guest + invitation + ceremony data into a `RsvpAnalytics` payload
 * that powers the analytics dashboard. Pure read service; no writes.
 */

import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  guests,
  guestLists,
  invitations,
  ceremonies,
  weddings,
  profiles,
} from '@smartshaadi/db';
import type { RsvpAnalytics, MealPref, RsvpStatus } from '@smartshaadi/types';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

async function assertWeddingOwner(weddingId: string, userId: string): Promise<void> {
  const [w] = await db
    .select({ id: weddings.id, profileId: weddings.profileId })
    .from(weddings)
    .where(eq(weddings.id, weddingId))
    .limit(1);
  if (!w) throw appErr('Wedding not found', 'NOT_FOUND', 404);

  const [p] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!p || w.profileId !== p.id) throw appErr('Forbidden', 'FORBIDDEN', 403);
}

function emptyAnalytics(): RsvpAnalytics {
  return {
    totalGuests:      0,
    invited:          0,
    responded:        0,
    responseRate:     0,
    byStatus:         { PENDING: 0, YES: 0, NO: 0, MAYBE: 0 } as Record<RsvpStatus, number>,
    byMealPref:       {
      VEG: 0, NON_VEG: 0, JAIN: 0, VEGAN: 0, EGGETARIAN: 0, NO_PREFERENCE: 0,
    } as Record<MealPref, number>,
    bySide:           { BRIDE: 0, GROOM: 0, BOTH: 0, UNKNOWN: 0 },
    attendanceForecast: 0,
    timeline:         [],
    byCeremony:       [],
    topDietary:       [],
    topAccessibility: [],
    checkedIn:        0,
  };
}

function bucketDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function topNFreq(strs: Array<string | null>, n = 5): Array<{ note: string; count: number }> {
  const m = new Map<string, number>();
  for (const s of strs) {
    if (!s) continue;
    const t = s.trim();
    if (!t) continue;
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([note, count]) => ({ note, count }));
}

export async function getRsvpAnalytics(
  weddingId: string,
  userId: string,
): Promise<RsvpAnalytics> {
  await assertWeddingOwner(weddingId, userId);

  const [gl] = await db.select({ id: guestLists.id }).from(guestLists)
    .where(eq(guestLists.weddingId, weddingId)).limit(1);
  if (!gl) return emptyAnalytics();

  const guestRows = await db
    .select({
      id:                guests.id,
      side:              guests.side,
      rsvpStatus:        guests.rsvpStatus,
      mealPref:          guests.mealPreference,
      plusOnes:          guests.plusOnes,
      isVip:             guests.isVip,
      arrivedAt:         guests.arrivedAt,
      dietaryNotes:      guests.dietaryNotes,
      accessibilityNotes: guests.accessibilityNotes,
    })
    .from(guests)
    .where(eq(guests.guestListId, gl.id));

  const invitationRows = await db
    .select({
      guestId: invitations.guestId,
      sentAt:  invitations.sentAt,
      rsvpAt:  invitations.rsvpAt,
    })
    .from(invitations);

  const ceremonyRows = await db
    .select({
      id:   ceremonies.id,
      type: ceremonies.type,
    })
    .from(ceremonies)
    .where(eq(ceremonies.weddingId, weddingId));

  const stats = emptyAnalytics();
  stats.totalGuests = guestRows.length;

  for (const g of guestRows) {
    stats.byStatus[g.rsvpStatus as RsvpStatus] += 1;
    stats.byMealPref[g.mealPref as MealPref] += 1;
    const sideKey = (g.side === 'BRIDE' || g.side === 'GROOM' || g.side === 'BOTH') ? g.side : 'UNKNOWN';
    stats.bySide[sideKey] += 1;
    if (g.arrivedAt) stats.checkedIn += 1;
  }

  const guestIdSet = new Set(guestRows.map(g => g.id));
  const sentByDate = new Map<string, number>();
  const respondedByDate = new Map<string, number>();
  let invited = 0;
  let responded = 0;
  for (const inv of invitationRows) {
    if (!guestIdSet.has(inv.guestId)) continue;
    invited += 1;
    const sentBucket = bucketDate(inv.sentAt);
    sentByDate.set(sentBucket, (sentByDate.get(sentBucket) ?? 0) + 1);
    if (inv.rsvpAt) {
      responded += 1;
      const respBucket = bucketDate(inv.rsvpAt);
      respondedByDate.set(respBucket, (respondedByDate.get(respBucket) ?? 0) + 1);
    }
  }
  stats.invited = invited;
  stats.responded = responded;
  stats.responseRate = invited > 0 ? Math.round((responded / invited) * 100) / 100 : 0;

  const allDates = new Set<string>([...sentByDate.keys(), ...respondedByDate.keys()]);
  stats.timeline = Array.from(allDates).sort().map(d => ({
    date:      d,
    sent:      sentByDate.get(d) ?? 0,
    responded: respondedByDate.get(d) ?? 0,
  }));

  // Forecast: confirmed YES + half of MAYBEs + their plusOnes
  let forecast = 0;
  for (const g of guestRows) {
    const headcount = 1 + (g.plusOnes ?? 0);
    if (g.rsvpStatus === 'YES') forecast += headcount;
    else if (g.rsvpStatus === 'MAYBE') forecast += headcount * 0.5;
  }
  stats.attendanceForecast = Math.round(forecast);

  // By-ceremony breakdown is left as a list of all ceremonies; the per-guest
  // attendance is tracked in guestCeremonyInvites and folded in when wired.
  stats.byCeremony = ceremonyRows.map(c => ({
    ceremonyId: c.id,
    type:       c.type,
    attending:  0,
    declined:   0,
    pending:    0,
  }));

  stats.topDietary       = topNFreq(guestRows.map(g => g.dietaryNotes));
  stats.topAccessibility = topNFreq(guestRows.map(g => g.accessibilityNotes));

  return stats;
}
