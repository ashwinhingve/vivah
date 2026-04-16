/**
 * Smart Shaadi — Matching Engine Orchestrator
 *
 * Responsibilities:
 *   1. getCachedFeed      — read pre-computed feed from Redis
 *   2. computeAndCacheFeed — build feed fresh: query → filter → score → cache
 *   3. scoreAndRank        — convert filtered ProfileData[] → sorted MatchFeedItem[]
 *
 * The DB parameter is typed as `unknown` here and narrowed internally so that
 * tests can pass a lightweight mock without importing the real Drizzle instance.
 * Production callers should pass the `db` singleton from apps/api/src/lib/db.ts.
 */

import type { MatchFeedItem } from '@smartshaadi/types';
import type Redis from 'ioredis';
import { applyHardFilters, type ProfileWithPreferences } from './filters.js';
import { scoreCandidate, type ProfileData } from './scorer.js';

// ── Feed cache key ────────────────────────────────────────────────────────────

const FEED_CACHE_TTL = 86400; // 24 hours

function feedKey(userId: string): string {
  return `match_feed:${userId}`;
}

// ── Income range parser ("5-10 LPA" → { min, max } in monthly ₹) ────────────

function parseIncomeRange(range: string | undefined | null): { min: number; max: number } {
  if (!range) return { min: 0, max: 999999 };
  // Handles "5-10 LPA", "10 LPA", "10-20 LPA"
  const lpaMatch = range.match(/(\d+)\s*[-–]?\s*(\d*)\s*LPA/i);
  if (lpaMatch) {
    const lo = parseInt(lpaMatch[1] ?? '0', 10);
    const hi = lpaMatch[2] ? parseInt(lpaMatch[2], 10) : lo;
    // Convert LPA to monthly
    return { min: Math.round((lo * 100000) / 12), max: Math.round((hi * 100000) / 12) };
  }
  return { min: 0, max: 999999 };
}

// ── Row shape returned by the joined DB query ─────────────────────────────────

interface ProfileRow {
  id:           string
  userId:       string
  isActive:     boolean
  personal?:    {
    fullName?:  string | null
    dob?:       Date | null
    religion?:  string | null
  } | null
  location?: {
    city?:  string | null
    state?: string | null
  } | null
  profession?: {
    occupation?: string | null
    incomeRange?: string | null
  } | null
  education?: {
    degree?: string | null
  } | null
  lifestyle?: {
    diet?:     string | null
    smoking?:  string | null
    drinking?: string | null
  } | null
  family?: {
    familyType?:   string | null
    familyValues?: string | null
  } | null
  partnerPreferences?: {
    ageRange?:        { min?: number | null; max?: number | null } | null
    religion?:        string[] | null
    openToInterfaith?: boolean | null
    incomeRange?:     string | null
    education?:       string[] | null
    diet?:            string[] | null
    familyType?:      string[] | null
  } | null
}

// ── Drizzle-compatible interface (duck-typed for testability) ─────────────────

interface SelectChain {
  from:     (table: unknown) => SelectChain
  where:    (condition: unknown) => SelectChain
  leftJoin: (table: unknown, condition: unknown) => SelectChain
  orderBy:  (column: unknown) => SelectChain
  limit:    (n: number) => Promise<unknown[]>
}

interface DrizzleDB {
  select: (fields?: unknown) => SelectChain
}

function assertDrizzleDB(db: unknown): asserts db is DrizzleDB {
  if (
    typeof db !== 'object' ||
    db === null ||
    typeof (db as Record<string, unknown>)['select'] !== 'function'
  ) {
    throw new TypeError('Invalid db instance passed to matching engine');
  }
}

// ── Row → ProfileData converter ───────────────────────────────────────────────

function rowToProfileData(row: ProfileRow): ProfileData {
  const dob      = row.personal?.dob;
  const age      = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : 28;
  const income   = parseIncomeRange(row.profession?.incomeRange);
  const prefIncome = parseIncomeRange(row.partnerPreferences?.incomeRange);
  const prefAgeMin = row.partnerPreferences?.ageRange?.min ?? 18;
  const prefAgeMax = row.partnerPreferences?.ageRange?.max ?? 50;

  return {
    id:           row.id,
    age,
    religion:     row.personal?.religion ?? 'Hindu',
    city:         row.location?.city ?? '',
    state:        row.location?.state ?? '',
    incomeMin:    income.min,
    incomeMax:    income.max,
    education:    row.education?.degree ?? 'bachelors',
    occupation:   row.profession?.occupation ?? '',
    familyType:   row.family?.familyType ?? 'JOINT',
    familyValues: row.family?.familyValues ?? 'MODERATE',
    diet:         row.lifestyle?.diet ?? 'VEG',
    smoke:        row.lifestyle?.smoking !== 'NEVER',
    drink:        row.lifestyle?.drinking !== 'NEVER',
    preferences: {
      ageMin:          prefAgeMin,
      ageMax:          prefAgeMax,
      religion:        (row.partnerPreferences?.religion as string[]) ?? [],
      openToInterfaith: row.partnerPreferences?.openToInterfaith ?? false,
      education:       (row.partnerPreferences?.education as string[]) ?? [],
      incomeMin:       prefIncome.min,
      incomeMax:       prefIncome.max,
      familyType:      (row.partnerPreferences?.familyType as string[]) ?? [],
      diet:            (row.partnerPreferences?.diet as string[]) ?? [],
    },
  };
}

// ── ProfileData → ProfileWithPreferences adapter ──────────────────────────────

function toFilterProfile(p: ProfileData): ProfileWithPreferences {
  return {
    id:         p.id,
    age:        p.age,
    religion:   p.religion,
    city:       p.city,
    state:      p.state,
    incomeMin:  p.incomeMin,
    incomeMax:  p.incomeMax,
    preferences: {
      ageMin:          p.preferences.ageMin,
      ageMax:          p.preferences.ageMax,
      religion:        p.preferences.religion,
      openToInterfaith: p.preferences.openToInterfaith,
      city:            p.city,
      state:           p.state,
      incomeMin:       p.preferences.incomeMin,
      incomeMax:       p.preferences.incomeMax,
    },
  };
}

// ── getCachedFeed ─────────────────────────────────────────────────────────────

export async function getCachedFeed(
  userId: string,
  redis: Redis,
): Promise<MatchFeedItem[] | null> {
  const raw = await redis.get(feedKey(userId));
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as MatchFeedItem[];
    return null;
  } catch {
    return null;
  }
}

// ── scoreAndRank ──────────────────────────────────────────────────────────────

export async function scoreAndRank(
  userId: string,
  filtered: ProfileData[],
  userProfile: ProfileData,
  redis: Redis,
  photoMap: Map<string, string | null>,
): Promise<MatchFeedItem[]> {
  const scored = await Promise.all(
    filtered.map(async (candidate) => {
      const compatibility = await scoreCandidate(
        userId,
        candidate.id,
        userProfile,
        candidate,
        redis,
      );

      // Determine if this is a "new" profile (seen within last 72h — placeholder)
      const isNew = false;

      const feedItem: MatchFeedItem = {
        profileId:     candidate.id,
        name:          '',  // populated by caller with raw row data
        age:           candidate.age,
        city:          candidate.city,
        compatibility,
        photoKey:      photoMap.get(candidate.id) ?? null,
        isNew,
      };

      return feedItem;
    }),
  );

  return scored.sort((a, b) => b.compatibility.totalScore - a.compatibility.totalScore);
}

// ── computeAndCacheFeed ───────────────────────────────────────────────────────

export async function computeAndCacheFeed(
  userId: string,
  rawDb: unknown,
  redis: Redis,
): Promise<MatchFeedItem[]> {
  assertDrizzleDB(rawDb);
  const db = rawDb;

  // Dynamically import schema to avoid circular deps in tests
  const { profiles, blockedUsers, profilePhotos } = await import('@smartshaadi/db');

  // 1. Get user's own profile row
  const userRows = await db
    .select()
    .from(profiles)
    .where({ userId } as unknown)
    .limit(1) as unknown[];

  if (userRows.length === 0) {
    await redis.setex(feedKey(userId), FEED_CACHE_TTL, JSON.stringify([]));
    return [];
  }

  const userRow = userRows[0] as ProfileRow;
  const userProfileId = userRow.id;

  // 2. Get blocked profile IDs (both directions)
  const blockedRows = await db
    .select()
    .from(blockedUsers)
    .where({ blockerId: userProfileId } as unknown)
    .limit(1000) as unknown[];

  const blockedByRows = await db
    .select()
    .from(blockedUsers)
    .where({ blockedId: userProfileId } as unknown)
    .limit(1000) as unknown[];

  const blockedSet = new Set<string>([
    ...(blockedRows as Array<{ blockedId: string }>).map((r) => r.blockedId),
    ...(blockedByRows as Array<{ blockerId: string }>).map((r) => r.blockerId),
    userProfileId, // exclude self
  ]);

  // 3. Query active candidate profiles
  const candidateRows = await db
    .select()
    .from(profiles)
    .where({ isActive: true } as unknown)
    .limit(500) as unknown[];

  // Filter out blocked / self
  const eligibleRows = (candidateRows as ProfileRow[]).filter(
    (r) => !blockedSet.has(r.id),
  );

  if (eligibleRows.length === 0) {
    await redis.setex(feedKey(userId), FEED_CACHE_TTL, JSON.stringify([]));
    return [];
  }

  // 4. Convert rows to ProfileData
  const userProfileData  = rowToProfileData(userRow);
  const candidateProfiles = eligibleRows.map(rowToProfileData);

  // 5. Apply hard filters (bilateral)
  const userFilterProfile = toFilterProfile(userProfileData);
  const candidateFilterProfiles = candidateProfiles.map(toFilterProfile);
  const passedFilterProfiles = applyHardFilters(userFilterProfile, candidateFilterProfiles);

  const passedIds = new Set(passedFilterProfiles.map((p) => p.id));
  const filteredProfiles = candidateProfiles.filter((p) => passedIds.has(p.id));

  if (filteredProfiles.length === 0) {
    await redis.setex(feedKey(userId), FEED_CACHE_TTL, JSON.stringify([]));
    return [];
  }

  // 6. Fetch primary photos for filtered candidates
  const photoMap = new Map<string, string | null>();
  for (const profile of filteredProfiles) {
    const photoRows = await db
      .select()
      .from(profilePhotos)
      .where({ profileId: profile.id, isPrimary: true } as unknown)
      .limit(1) as unknown[];
    const photoRow = (photoRows[0] ?? null) as { r2Key?: string } | null;
    photoMap.set(profile.id, photoRow?.r2Key ?? null);
  }

  // 7. Score and rank
  const nameMap = new Map<string, string>(
    eligibleRows.map((r) => [
      r.id,
      r.personal?.fullName ?? 'Unknown',
    ]),
  );

  const ranked = await scoreAndRank(userId, filteredProfiles, userProfileData, redis, photoMap);

  // Attach names to feed items
  const feed: MatchFeedItem[] = ranked.map((item) => ({
    ...item,
    name: nameMap.get(item.profileId) ?? 'Unknown',
  }));

  // 8. Cache result
  await redis.setex(feedKey(userId), FEED_CACHE_TTL, JSON.stringify(feed));

  return feed;
}
