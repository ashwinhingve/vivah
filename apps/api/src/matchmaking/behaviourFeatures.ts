/**
 * behaviourFeatures.ts — load 30-day behaviour rollups for a set of users.
 *
 * Reads from user_behavior_summary (per-day per-user rows) and aggregates
 * to a per-user rollup used by scoreBehaviourCompat in scorer.ts.
 *
 * Cold-start: when a user has fewer than 7 days of recorded summary rows
 * we mark the rollup with `daysWithData < 7` so the scorer can fall back
 * to a neutral 50 instead of penalising new users.
 */
import { and, gte, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { userBehaviorSummary } from '@smartshaadi/db';

export interface BehaviourRollup {
  userId:           string;
  activityLevel:    number;      // 0..1, normalized via log10
  messageFrequency: number;      // raw daily average messages
  hourlyHist:       number[];    // 24 ints, summed over the window
  daysWithData:     number;
}

const WINDOW_DAYS = 30;
const COLD_START_THRESHOLD = 7;

function buildRollup(userId: string, rows: Array<{
  profileViewCount:   number;
  browseQueryCount:   number;
  messageCount:       number;
  hourlyActivityHist: unknown;
}>): BehaviourRollup {
  const histAgg = new Array<number>(24).fill(0);
  let viewsSum = 0;
  let browseSum = 0;
  let messagesSum = 0;
  for (const r of rows) {
    viewsSum += r.profileViewCount;
    browseSum += r.browseQueryCount;
    messagesSum += r.messageCount;
    if (Array.isArray(r.hourlyActivityHist)) {
      for (let i = 0; i < 24; i++) {
        const v = (r.hourlyActivityHist as number[])[i];
        histAgg[i] = (histAgg[i] ?? 0) + (typeof v === 'number' ? v : 0);
      }
    }
  }
  const days = rows.length;
  const avgViews = days > 0 ? viewsSum / days : 0;
  const avgBrowse = days > 0 ? browseSum / days : 0;
  // log10((views+browse)/2 + 1) / 2 → 0..1 roughly. Caps activity_level.
  const activityRaw = Math.log10((avgViews + avgBrowse) / 2 + 1) / 2;
  const activityLevel = Math.min(1, Math.max(0, activityRaw));
  const messageFrequency = days > 0 ? messagesSum / days : 0;

  return {
    userId,
    activityLevel,
    messageFrequency,
    hourlyHist: histAgg,
    daysWithData: days,
  };
}

function emptyRollup(userId: string): BehaviourRollup {
  return {
    userId,
    activityLevel: 0,
    messageFrequency: 0,
    hourlyHist: new Array<number>(24).fill(0),
    daysWithData: 0,
  };
}

export async function getBehaviourRollup(
  userIds: string[],
): Promise<Map<string, BehaviourRollup>> {
  const map = new Map<string, BehaviourRollup>();
  if (userIds.length === 0) return map;

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const sinceDay = since.toISOString().slice(0, 10);

  const rows = await db
    .select({
      userId:             userBehaviorSummary.userId,
      profileViewCount:   userBehaviorSummary.profileViewCount,
      browseQueryCount:   userBehaviorSummary.browseQueryCount,
      messageCount:       userBehaviorSummary.messageCount,
      hourlyActivityHist: userBehaviorSummary.hourlyActivityHist,
    })
    .from(userBehaviorSummary)
    .where(
      and(
        inArray(userBehaviorSummary.userId, userIds),
        gte(userBehaviorSummary.day, sinceDay),
      ),
    );

  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = grouped.get(r.userId) ?? [];
    list.push(r);
    grouped.set(r.userId, list);
  }

  for (const uid of userIds) {
    const list = grouped.get(uid);
    map.set(uid, list ? buildRollup(uid, list) : emptyRollup(uid));
  }
  return map;
}

export function isColdStart(rollup: BehaviourRollup | undefined): boolean {
  return !rollup || rollup.daysWithData < COLD_START_THRESHOLD;
}
