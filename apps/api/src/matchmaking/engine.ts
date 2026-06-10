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

import type {
  MatchFeedItem,
  PersonalityProfile,
  MustHaveFlags,
  PersonalityIdeal,
  MaritalStatus,
} from '@smartshaadi/types';
import type Redis from 'ioredis';
import { eq, and, inArray } from 'drizzle-orm';
import { applyHardFilters, type ProfileWithPreferences } from './filters.js';
import { isLGBTQMatchingEnabled } from '../services/platformSettingsService.js';
import { scoreCandidate, type ProfileData } from './scorer.js';
import { getBehaviourRollup, type BehaviourRollup } from './behaviourFeatures.js';
import { explainMatch } from './explainer.js';
import {
  mmrRerank,
  buildClusterKeys,
  type ClusterableItem,
} from './diversity.js';
import { haversineKm } from '../lib/geocode.js';
import { matchComputeQueue } from '../infrastructure/redis/queues.js';
import { env, shouldUseMockMongo } from '../lib/env.js';
import { mockGet } from '../lib/mockStore.js';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import { batchComputeJointScores } from '../services/familyCompatService.js';

// ── Feed cache key ────────────────────────────────────────────────────────────

const FEED_CACHE_TTL = 86400; // 24h — matches feed-cache standard

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
  lastActiveAt?: Date | string | null
  premiumTier?: 'FREE' | 'STANDARD' | 'PREMIUM'
  latitude?:    number | string | null
  longitude?:   number | string | null
  personality?: PersonalityProfile | null
  personal?:    {
    fullName?:     string | null
    dob?:          Date | null
    religion?:     string | null
    maritalStatus?: MaritalStatus | null
    gender?:       'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | null
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
    manglik?:         'ANY' | 'ONLY_MANGLIK' | 'NON_MANGLIK' | null
    openToInterCaste?: boolean | null
    maxDistanceKm?:   number | null
    mustHave?:        MustHaveFlags | null
    personalityIdeal?: PersonalityIdeal | null
    maritalStatus?:   MaritalStatus[] | null
    partnerGender?:   Array<'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER'> | null
  } | null
  horoscope?: {
    manglik?: 'YES' | 'NO' | 'PARTIAL' | null
  } | null
  community?: {
    community?:    string | null
    subCommunity?: string | null
    caste?:        string | null
    gotra?:        string | null
    motherTongue?: string | null
    gotraExclusionEnabled?: boolean | null
    divorceeSupport?: boolean | null
  } | null
  maritalStatus?: MaritalStatus | null
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

// ── Row enrichment ────────────────────────────────────────────────────────────
//
// Postgres `profiles` table stores only metadata (status, completeness, flags).
// The JSON sections referenced by ProfileRow — personal, location, profession,
// etc. — live in MongoDB (`profiles_content`) or, in mock mode, in mockStore.
// Without this merge, every row has empty sections, which makes age default to
// 0 in rowToProfileData and then fails applyHardFilters' age/religion/location
// checks — the feed ends up empty even for complete profiles.

type ContentDoc = {
  personal?:           ProfileRow['personal']
  location?:           ProfileRow['location']
  profession?:         ProfileRow['profession']
  education?:          ProfileRow['education']
  lifestyle?:          ProfileRow['lifestyle']
  family?:             ProfileRow['family']
  partnerPreferences?: ProfileRow['partnerPreferences']
  horoscope?:          ProfileRow['horoscope']
  personality?:        PersonalityProfile | null
  safetyMode?: {
    photoHidden?:        boolean
    contactHidden?:      boolean
    incognito?:          boolean
    showLastActive?:     boolean
    showReadReceipts?:   boolean
    photoBlurUntilUnlock?: boolean
    hideFromSearch?:     boolean
    allowMessageFrom?:   'EVERYONE' | 'VERIFIED_ONLY' | 'SAME_COMMUNITY' | 'ACCEPTED_ONLY'
  } | null
};

async function loadContentForUser(uid: string): Promise<ContentDoc | null> {
  if (shouldUseMockMongo) {
    const doc = mockGet(uid) as ContentDoc | null;
    return doc ?? null;
  }
  const model = ProfileContent as unknown as {
    findOne: (filter: object) => { lean: () => Promise<ContentDoc | null> }
  };
  return (await model.findOne({ userId: uid }).lean()) ?? null;
}

/**
 * Batched content load — ONE Mongo round-trip for ALL candidate userIds (was a
 * per-candidate findOne inside the feed loop — the N+1 this refactor kills).
 * Mock-guarded (Rule 11): in mock mode reads the in-memory mockStore per uid
 * (no round-trips); live mode issues a single `find({ userId: { $in } })`.
 */
async function loadContentForUsers(uids: string[]): Promise<Map<string, ContentDoc>> {
  const map = new Map<string, ContentDoc>();
  if (uids.length === 0) return map;
  if (shouldUseMockMongo) {
    for (const uid of uids) {
      const doc = mockGet(uid) as ContentDoc | null;
      if (doc) map.set(uid, doc);
    }
    return map;
  }
  const model = ProfileContent as unknown as {
    find: (filter: object) => { lean: () => Promise<Array<ContentDoc & { userId: string }>> }
  };
  const docs = await model.find({ userId: { $in: uids } }).lean();
  for (const d of docs) if (d?.userId) map.set(d.userId, d);
  return map;
}

export function enrichRowWithDoc(row: ProfileRow, doc: ContentDoc | null): ProfileRow {
  if (!doc) return row;
  const enriched: ProfileRow = { id: row.id, userId: row.userId, isActive: row.isActive };
  const personal           = doc.personal           ?? row.personal;
  const location           = doc.location           ?? row.location;
  const profession         = doc.profession         ?? row.profession;
  const education          = doc.education          ?? row.education;
  const lifestyle          = doc.lifestyle          ?? row.lifestyle;
  const family             = doc.family             ?? row.family;
  const partnerPreferences = doc.partnerPreferences ?? row.partnerPreferences;
  if (personal           !== undefined) enriched.personal           = personal;
  if (location           !== undefined) enriched.location           = location;
  if (profession         !== undefined) enriched.profession         = profession;
  if (education          !== undefined) enriched.education          = education;
  if (lifestyle          !== undefined) enriched.lifestyle          = lifestyle;
  if (family             !== undefined) enriched.family             = family;
  if (partnerPreferences !== undefined) enriched.partnerPreferences = partnerPreferences;
  const horoscope = doc.horoscope ?? row.horoscope;
  if (horoscope !== undefined) enriched.horoscope = horoscope;
  if (row.community !== undefined) enriched.community = row.community;
  // maritalStatus lives in MongoDB personal section — read via the merged personal doc
  const mergedPersonal = doc.personal ?? row.personal;
  const maritalStatus =
    (mergedPersonal as { maritalStatus?: MaritalStatus | null } | undefined)?.maritalStatus
    ?? row.maritalStatus
    ?? null;
  enriched.maritalStatus = maritalStatus;
  const personality = doc.personality ?? row.personality;
  if (personality !== undefined && personality !== null) enriched.personality = personality;
  if (row.latitude  !== undefined) enriched.latitude  = row.latitude;
  if (row.longitude !== undefined) enriched.longitude = row.longitude;
  return enriched;
}

/** Back-compat single-row wrapper. The feed hot path uses enrichRowWithDoc with a batched map. */
export async function enrichRow(row: ProfileRow): Promise<ProfileRow> {
  return enrichRowWithDoc(row, await loadContentForUser(row.userId));
}

// ── Row → ProfileData converter ───────────────────────────────────────────────

export function rowToProfileData(row: ProfileRow): ProfileData {
  const dob      = row.personal?.dob;
  // Scorer needs a numeric age. Use 0 when dob is missing; this makes the user
  // fail any realistic age-range filter, so they naturally stay out of feeds
  // until they complete their profile. The feed output shape masks this to null.
  const age      = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : 0;
  const income   = parseIncomeRange(row.profession?.incomeRange);
  const prefIncome = parseIncomeRange(row.partnerPreferences?.incomeRange);
  const prefAgeMin = row.partnerPreferences?.ageRange?.min ?? 18;
  const prefAgeMax = row.partnerPreferences?.ageRange?.max ?? 50;
  const lat = row.latitude  != null ? Number(row.latitude)  : null;
  const lng = row.longitude != null ? Number(row.longitude) : null;

  return {
    id:           row.id,
    age,
    gender:       (row.personal?.gender ?? null),
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
    manglik:      row.horoscope?.manglik ?? null,
    caste:        row.community?.caste ?? null,
    gotra:        row.community?.gotra ?? null,
    gotraExclusionEnabled: row.community?.gotraExclusionEnabled ?? true,
    community:    row.community?.community ?? null,
    maritalStatus: (row.maritalStatus ?? null) as MaritalStatus | null,
    preferredMaritalStatuses: (row.partnerPreferences?.maritalStatus as MaritalStatus[] | undefined) ?? null,
    divorceeSupport: row.community?.divorceeSupport === true,
    lastActiveAt: row.lastActiveAt instanceof Date ? row.lastActiveAt.toISOString() : (row.lastActiveAt ?? null),
    premiumTier:  row.premiumTier ?? 'FREE',
    latitude:     Number.isFinite(lat as number) ? lat : null,
    longitude:    Number.isFinite(lng as number) ? lng : null,
    personality:  row.personality ?? null,
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
      manglik:         row.partnerPreferences?.manglik ?? 'ANY',
      openToInterCaste: row.partnerPreferences?.openToInterCaste ?? false,
      maxDistanceKm:   row.partnerPreferences?.maxDistanceKm ?? 100,
      mustHave:        row.partnerPreferences?.mustHave ?? {},
      personalityIdeal: row.partnerPreferences?.personalityIdeal ?? {},
      ...(row.partnerPreferences?.partnerGender ? { partnerGender: row.partnerPreferences.partnerGender } : {}),
    },
  };
}

// ── ProfileData → ProfileWithPreferences adapter ──────────────────────────────

function toFilterProfile(p: ProfileData): ProfileWithPreferences {
  return {
    id:         p.id,
    age:        p.age,
    gender:     p.gender ?? null,
    religion:   p.religion,
    city:       p.city,
    state:      p.state,
    incomeMin:  p.incomeMin,
    incomeMax:  p.incomeMax,
    manglik:    p.manglik ?? null,
    caste:      p.caste ?? null,
    gotra:      p.gotra ?? null,
    gotraExclusionEnabled: p.gotraExclusionEnabled ?? true,
    latitude:   p.latitude  ?? null,
    longitude:  p.longitude ?? null,
    education:  p.education,
    diet:       p.diet,
    maritalStatus:            p.maritalStatus ?? null,
    preferredMaritalStatuses: p.preferredMaritalStatuses ?? null,
    divorceeSupport:          p.divorceeSupport ?? false,
    preferences: {
      ageMin:          p.preferences.ageMin,
      ageMax:          p.preferences.ageMax,
      religion:        p.preferences.religion,
      openToInterfaith: p.preferences.openToInterfaith,
      city:            p.city,
      state:           p.state,
      incomeMin:       p.preferences.incomeMin,
      incomeMax:       p.preferences.incomeMax,
      education:       p.preferences.education ?? [],
      diet:            p.preferences.diet ?? [],
      ...(p.preferences.maxDistanceKm !== undefined ? { maxDistanceKm: p.preferences.maxDistanceKm } : {}),
      ...(p.preferences.mustHave      !== undefined ? { mustHave:      p.preferences.mustHave      } : {}),
      ...(p.preferences.manglik          ? { manglik: p.preferences.manglik } : {}),
      ...(p.preferences.openToInterCaste !== undefined ? { openToInterCaste: p.preferences.openToInterCaste } : {}),
      ...(p.preferences.partnerGender ? { partnerGender: p.preferences.partnerGender } : {}),
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

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

export async function scoreAndRank(
  userId: string,
  filtered: ProfileData[],
  userProfile: ProfileData,
  redis: Redis,
  photoMap: Map<string, string | null>,
  createdAtMap?: Map<string, Date | null>,
  userBehaviour?: BehaviourRollup,
  behaviourByProfileId?: Map<string, BehaviourRollup>,
): Promise<MatchFeedItem[]> {
  const now = Date.now();
  const scored = await Promise.all(
    filtered.map(async (candidate) => {
      const compatibility = await scoreCandidate(
        userId,
        candidate.id,
        userProfile,
        candidate,
        redis,
        userBehaviour,
        behaviourByProfileId?.get(candidate.id),
      );

      const createdAt = createdAtMap?.get(candidate.id) ?? null;
      const isNew = createdAt ? now - createdAt.getTime() < SEVENTY_TWO_HOURS_MS : false;

      const distanceKm: number | null =
        typeof userProfile.latitude === 'number' && typeof userProfile.longitude === 'number' &&
        typeof candidate.latitude  === 'number' && typeof candidate.longitude  === 'number'
          ? haversineKm(
              { lat: userProfile.latitude, lng: userProfile.longitude },
              { lat: candidate.latitude,  lng: candidate.longitude },
            )
          : null;

      const explainer = explainMatch(userProfile, candidate, compatibility, distanceKm);

      const feedItem: MatchFeedItem = {
        profileId:     candidate.id,
        name:          '',
        age:           candidate.age,
        city:          candidate.city,
        compatibility,
        photoKey:      photoMap.get(candidate.id) ?? null,
        isNew,
        // finalised by the caller (computeAndCacheFeed) before caching
        isVerified:    true,
        photoHidden:   photoMap.get(candidate.id) === null,
        shortlisted:   false,
        manglik:       candidate.manglik ?? null,
        lastActiveAt:  candidate.lastActiveAt ?? null,
        premiumTier:   candidate.premiumTier ?? 'FREE',
        distanceKm,
        explainer,
      };

      return feedItem;
    }),
  );

  // P3 Family Compatibility: enrich feed items with joint family score where
  // family ratings exist. Best-effort — failures here must not break the feed.
  try {
    const candidateIds = scored.map((s) => s.profileId);
    const joints = await batchComputeJointScores(userProfile.id, candidateIds);
    for (const item of scored) {
      const j = joints.get(item.profileId);
      if (j && j.familySignalCount > 0) {
        item.familyJointScore   = j.jointScore;
        item.familySignalCount  = j.familySignalCount;
        item.familyAgreementPct = j.agreementPct;
      }
    }
  } catch {
    /* non-fatal */
  }

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

  if (env.FEED_DEBUG) console.info('[feed][start] computeAndCacheFeed', { userId });

  // 1. Get user's own profile row
  const userRows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1) as unknown[];

  if (env.FEED_DEBUG) console.info('[feed][step1] user profile fetch', { userId, found: userRows.length });

  if (userRows.length === 0) {
    if (env.FEED_DEBUG) console.info('[feed][exit1] no profile row for userId — empty feed cached', { userId });
    await redis.setex(feedKey(userId), FEED_CACHE_TTL, JSON.stringify([]));
    return [];
  }

  const userRowRaw = userRows[0] as ProfileRow;
  const userRow = await enrichRow(userRowRaw);
  const userProfileId = userRow.id;

  // 2. Get blocked profile IDs (both directions). No row cap — a >1000 cap
  // silently let blocks past the feed filter, surfacing people the user
  // blocked. Block lists are small; fetch all so the exclusion set is complete.
  const blockedRows = (await (db
    .select({ blockedId: blockedUsers.blockedId })
    .from(blockedUsers)
    .where(eq(blockedUsers.blockerId, userProfileId)) as unknown as Promise<unknown[]>));

  const blockedByRows = (await (db
    .select({ blockerId: blockedUsers.blockerId })
    .from(blockedUsers)
    .where(eq(blockedUsers.blockedId, userProfileId)) as unknown as Promise<unknown[]>));

  const blockedSet = new Set<string>([
    ...(blockedRows as Array<{ blockedId: string }>).map((r) => r.blockedId),
    ...(blockedByRows as Array<{ blockerId: string }>).map((r) => r.blockerId),
    userProfileId, // exclude self
  ]);

  // 3. Query active + KYC-verified candidate profiles only — unverified profiles
  // must never surface in match feeds (rule 5 — privacy + safety)
  const candidateRows = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.isActive, true), eq(profiles.verificationStatus, 'VERIFIED')))
    .limit(500) as unknown[];

  if (env.FEED_DEBUG) console.info('[feed][step2] candidate query (active+VERIFIED) rows', {
    userId,
    rawCount: candidateRows.length,
    blockedSetSize: blockedSet.size,
  });

  // Filter out blocked / self
  const eligibleRowsRaw = (candidateRows as ProfileRow[]).filter(
    (r) => !blockedSet.has(r.id),
  );

  if (env.FEED_DEBUG) console.info('[feed][step3] after blocked/self filter', {
    userId,
    count: eligibleRowsRaw.length,
    droppedByBlock: candidateRows.length - eligibleRowsRaw.length,
  });

  if (eligibleRowsRaw.length === 0) {
    if (env.FEED_DEBUG) console.info('[feed][exit3] no candidates after blocked/self filter — empty feed cached', { userId });
    await redis.setex(feedKey(userId), FEED_CACHE_TTL, JSON.stringify([]));
    return [];
  }

  // 3a. Bulk-load community_zones for everyone in one query — caste/gotra/
  // manglik filters need it. Done as a side-load (not a JOIN) to keep
  // candidate query untouched and avoid Drizzle nested-row reshape.
  const { communityZones } = await import('@smartshaadi/db');
  const allProfileIds: string[] = [userProfileId, ...eligibleRowsRaw.map((r) => r.id)];
  const czRows = await db
    .select()
    .from(communityZones)
    .where(inArray(communityZones.profileId, allProfileIds))
    .limit(1000) as unknown[];
  const czMap = new Map<string, ProfileRow['community']>();
  for (const raw of czRows as Array<{
    profileId: string;
    community: string | null;
    subCommunity: string | null;
    caste: string | null;
    gotra: string | null;
    motherTongue: string | null;
    gotraExclusionEnabled: boolean | null;
    divorceeSupport_enabled?: boolean | null;
  }>) {
    czMap.set(raw.profileId, {
      community:    raw.community,
      subCommunity: raw.subCommunity,
      caste:        raw.caste,
      gotra:        raw.gotra,
      motherTongue: raw.motherTongue,
      gotraExclusionEnabled: raw.gotraExclusionEnabled,
      divorceeSupport: raw.divorceeSupport_enabled === true,
    });
  }
  const userCz = czMap.get(userProfileId);
  if (userCz) userRow.community = userCz;
  for (const r of eligibleRowsRaw) {
    const cz = czMap.get(r.id);
    if (cz) r.community = cz;
  }

  // Batch-load ProfileContent for every candidate in ONE round-trip (was a
  // per-candidate findOne — the N+1 this refactor kills). This single map is the
  // source of truth reused below for enrichment, safety flags, and name/age/city.
  const contentByUserId = await loadContentForUsers(eligibleRowsRaw.map((r) => r.userId));

  // Enrich candidates from the batched map so downstream filters see real
  // age / religion / location / preferences, not schema defaults.
  const eligibleRowsEnriched = eligibleRowsRaw.map(
    (r) => enrichRowWithDoc(r, contentByUserId.get(r.userId) ?? null),
  );

  // 3b. Load safety flags for every candidate from the same map; hide incognito
  // users from other people's feeds entirely. Incognito viewers still see
  // everyone — the filter is one-directional.
  const safetyByProfileId = new Map<string, NonNullable<ContentDoc['safetyMode']>>();
  for (const r of eligibleRowsEnriched) {
    const doc = contentByUserId.get(r.userId);
    if (doc?.safetyMode) safetyByProfileId.set(r.id, doc.safetyMode);
  }
  const eligibleRows = eligibleRowsEnriched.filter((r) => {
    const sm = safetyByProfileId.get(r.id);
    return !(sm?.incognito || sm?.hideFromSearch);
  });

  if (env.FEED_DEBUG) console.info('[feed][step4] after safety (incognito/hideFromSearch) filter', {
    userId,
    count: eligibleRows.length,
    droppedBySafety: eligibleRowsEnriched.length - eligibleRows.length,
  });

  if (eligibleRows.length === 0) {
    if (env.FEED_DEBUG) console.info('[feed][exit4] no candidates after safety filter — empty feed cached', { userId });
    await redis.setex(feedKey(userId), FEED_CACHE_TTL, JSON.stringify([]));
    return [];
  }

  // 4. Convert rows to ProfileData
  const userProfileData  = rowToProfileData(userRow);
  const candidateProfiles = eligibleRows.map(rowToProfileData);

  // 5. Apply hard filters (bilateral)
  const userFilterProfile = toFilterProfile(userProfileData);
  const candidateFilterProfiles = candidateProfiles.map(toFilterProfile);

  // Read once per feed build. Failure here (e.g. db down, table missing in
  // unit tests) must not break matching — default to false (legacy behavior).
  let lgbtqEnabled = false;
  try {
    lgbtqEnabled = await isLGBTQMatchingEnabled();
  } catch {
    lgbtqEnabled = false;
  }
  const passedFilterProfiles = applyHardFilters(userFilterProfile, candidateFilterProfiles, { lgbtqEnabled });

  const passedIds = new Set(passedFilterProfiles.map((p) => p.id));
  const filteredProfiles = candidateProfiles.filter((p) => passedIds.has(p.id));

  if (env.FEED_DEBUG) console.info('[feed][step5] after applyHardFilters (bilateral)', {
    userId,
    countIn:  candidateFilterProfiles.length,
    countOut: filteredProfiles.length,
    droppedByFilters: candidateFilterProfiles.length - filteredProfiles.length,
    passedIds: Array.from(passedIds),
  });

  if (filteredProfiles.length === 0) {
    if (env.FEED_DEBUG) console.info('[feed][exit5] all candidates rejected by hard filters — empty feed cached', { userId });
    await redis.setex(feedKey(userId), FEED_CACHE_TTL, JSON.stringify([]));
    return [];
  }

  // 6. Fetch primary photos for filtered candidates, respecting
  //    safetyMode.photoHidden + safetyModeUnlocks (CLAUDE.md rule 5 — photos
  //    are private until the viewer has an unlock record for the candidate).
  const { safetyModeUnlocks, shortlists } = await import('@smartshaadi/db');
  const photoHiddenProfileIds = new Set<string>();
  for (const profile of filteredProfiles) {
    if (safetyByProfileId.get(profile.id)?.photoHidden) {
      photoHiddenProfileIds.add(profile.id);
    }
  }
  let unlockedProfileIds = new Set<string>();
  if (photoHiddenProfileIds.size > 0) {
    const unlockRows = await (db as unknown as DrizzleDB)
      .select({ profileId: safetyModeUnlocks.profileId })
      .from(safetyModeUnlocks)
      .where(
        and(
          inArray(safetyModeUnlocks.profileId, Array.from(photoHiddenProfileIds)),
          eq(safetyModeUnlocks.unlockedFor, userRow.id),
        ),
      )
      .limit(photoHiddenProfileIds.size) as unknown as { profileId: string }[];
    unlockedProfileIds = new Set(unlockRows.map(r => r.profileId));
  }
  const photoMap = new Map<string, string | null>();
  // Hidden-and-not-unlocked candidates get a null photo with no query; everyone
  // else is fetched in ONE batched primary-photo read (was one SELECT per
  // candidate — the Postgres half of the N+1).
  const visiblePhotoIds: string[] = [];
  for (const profile of filteredProfiles) {
    if (photoHiddenProfileIds.has(profile.id) && !unlockedProfileIds.has(profile.id)) {
      photoMap.set(profile.id, null);
    } else {
      visiblePhotoIds.push(profile.id);
    }
  }
  if (visiblePhotoIds.length > 0) {
    const photoRows = await (db as unknown as DrizzleDB)
      .select({ profileId: profilePhotos.profileId, r2Key: profilePhotos.r2Key })
      .from(profilePhotos)
      .where(and(inArray(profilePhotos.profileId, visiblePhotoIds), eq(profilePhotos.isPrimary, true)))
      .limit(visiblePhotoIds.length) as unknown as Array<{ profileId: string; r2Key: string | null }>;
    const r2ByProfileId = new Map<string, string | null>();
    for (const pr of photoRows) r2ByProfileId.set(pr.profileId, pr.r2Key ?? null);
    for (const id of visiblePhotoIds) photoMap.set(id, r2ByProfileId.get(id) ?? null);
  }

  // 7. Score and rank
  const nameMap = new Map<string, string>(
    eligibleRows.map((r) => [r.id, r.personal?.fullName ?? 'Unknown']),
  );
  const userIdMap = new Map<string, string>(
    eligibleRows.map((r) => [r.id, r.userId]),
  );
  const createdAtMap = new Map<string, Date | null>(
    (candidateRows as Array<{ id: string; createdAt?: Date | string | null }>).map(
      (r) => [r.id, r.createdAt ? new Date(r.createdAt) : null],
    ),
  );

  // Bulk-fetch behaviour rollups for both the viewer and all candidates so
  // scoreBehaviourCompat can read activity_level / message_frequency / hourly
  // histogram per pair.
  const candidateUserIds = Array.from(userIdMap.values());
  const rollupUserIds = Array.from(new Set([userId, ...candidateUserIds]));
  const rollupByUserId = await getBehaviourRollup(rollupUserIds);
  const userBehaviour = rollupByUserId.get(userId);
  const behaviourByProfileId = new Map<string, BehaviourRollup>();
  for (const [profileId, uid] of userIdMap.entries()) {
    const r = rollupByUserId.get(uid);
    if (r) behaviourByProfileId.set(profileId, r);
  }

  const ranked = await scoreAndRank(
    userId,
    filteredProfiles,
    userProfileData,
    redis,
    photoMap,
    createdAtMap,
    userBehaviour,
    behaviourByProfileId,
  );

  // Shortlisted set — which candidates has the viewer already saved?
  const shortlistRows = await (db as unknown as DrizzleDB)
    .select({ target: shortlists.targetProfileId })
    .from(shortlists)
    .where(eq(shortlists.profileId, userProfileId))
    .limit(1000) as unknown as { target: string }[];
  const shortlistedSet = new Set(shortlistRows.map((r) => r.target));

  // Attach names/ages/cities from the SAME batched content map loaded in step 3
  // (was a per-candidate ProfileContent.findOne here — the last leg of the N+1).
  // Same fields, same age math → identical output, zero extra round-trips.
  const feed: MatchFeedItem[] = ranked.map((item) => {
    const uid = userIdMap.get(item.profileId);
    let name = nameMap.get(item.profileId) ?? 'Unknown';
    let age: number | null = item.age != null && item.age > 0 ? item.age : null;
    let city = item.city;

    const doc = uid ? contentByUserId.get(uid) : undefined;
    if (doc) {
      const personal = doc.personal as { fullName?: string; dob?: Date | string } | undefined;
      const loc = doc.location as { city?: string } | undefined;
      if (personal?.fullName) name = personal.fullName;
      if (personal?.dob) age = Math.floor((Date.now() - new Date(personal.dob).getTime()) / 31557600000);
      if (loc?.city) city = loc.city;
    }

    const photoHidden =
      photoHiddenProfileIds.has(item.profileId) &&
      !unlockedProfileIds.has(item.profileId);

    return {
      ...item,
      name,
      age,
      city,
      // every candidate passes the VERIFIED status gate in step 3 above
      isVerified:  true,
      photoHidden,
      shortlisted: shortlistedSet.has(item.profileId),
    };
  });

  // 8. Fire-and-forget: enqueue guna recalc for any pairs missing a score
  const pendingPairs = feed
    .filter((item) => item.compatibility.flags.includes('guna_pending'))
    .map((item) => {
      const sorted = [userProfileId, item.profileId].sort();
      return { profileAId: sorted[0] as string, profileBId: sorted[1] as string };
    });

  if (pendingPairs.length > 0) {
    void matchComputeQueue
      .addBulk(pendingPairs.map((data) => ({ name: 'guna-recalc', data })))
      .catch((err: unknown) => {
        console.error('Failed to enqueue guna recalc jobs:', err);
      });
  }

  // 9. MMR diversity rerank (λ=0.7) over caste/occupation/city/age cluster keys
  const enrichedForMmr: Array<MatchFeedItem & ClusterableItem> = feed.map((item) => {
    const candProfile = candidateProfiles.find((p) => p.id === item.profileId);
    const cluster = buildClusterKeys({
      caste:              candProfile?.caste ?? null,
      occupationCategory: candProfile?.occupation ?? null,
      city:               candProfile?.city ?? null,
      age:                candProfile?.age ?? null,
    });
    return Object.assign(item, { _clusterKeys: cluster });
  });
  const reranked = mmrRerank(enrichedForMmr, 0.7, 50)
    .map(({ _clusterKeys: _ck, ...rest }) => rest as MatchFeedItem);

  // 10. Cache result
  await redis.setex(feedKey(userId), FEED_CACHE_TTL, JSON.stringify(reranked));

  if (env.FEED_DEBUG) console.info('[feed][done] feed computed and cached', { userId, finalCount: reranked.length });

  return reranked;
}
