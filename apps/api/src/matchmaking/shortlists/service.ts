/**
 * Smart Shaadi — Shortlists Service
 *
 * A shortlist is a one-sided bookmark: a profile pins another profile for
 * later review. It does NOT imply a match request has been sent.
 *
 * Rules:
 * - Cannot shortlist yourself (SELF_SHORTLIST)
 * - Duplicate insert is silently ignored (onConflictDoNothing)
 * - MongoDB ProfileContent reads are guarded with USE_MOCK_SERVICES
 */

import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { shouldUseMockMongo } from '../../lib/env.js';
import { shortlists, profiles, profilePhotos } from '@smartshaadi/db';
import type { ProfileId } from '@smartshaadi/types';
import { ProfileContent as ProfileContentModel } from '../../infrastructure/mongo/models/ProfileContent.js';

// ProfileContent is exported as `unknown` to prevent re-registration issues.
// Cast it here to the minimal interface we need.
interface IProfileContent {
  findOne(filter: Record<string, unknown>): { lean(): Promise<ProfileContentDoc | null> };
  find(filter: Record<string, unknown>): { lean(): Promise<Array<ProfileContentDoc & { userId: string }>> };
}
interface ProfileContentDoc {
  personal?: { fullName?: string; dob?: Date };
  location?: { city?: string };
}
const ProfileContent = ProfileContentModel as unknown as IProfileContent;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceError extends Error {
  code: string;
}

export interface ShortlistItem {
  id: string;
  profileId: string;
  targetProfileId: string;
  note: string | null;
  createdAt: Date;
  // Enriched target profile fields
  name: string | null;
  age: number | null;
  city: string | null;
  primaryPhotoKey: string | null;
  verificationStatus: string;
}

export interface PaginatedShortlists {
  items: ShortlistItem[];
  total: number;
  page: number;
  limit: number;
}

// ── Error factory ─────────────────────────────────────────────────────────────

function serviceError(code: string, message: string): ServiceError {
  const e = new Error(message) as ServiceError;
  e.code = code;
  return e;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ageFromDob(dob: Date | null | undefined): number | null {
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

// ── addShortlist ──────────────────────────────────────────────────────────────

/**
 * Bookmark targetProfileId for profileId.
 * Duplicate pairs are silently ignored (onConflictDoNothing).
 * Returns the existing or newly created row.
 */
export async function addShortlist(
  profileId: ProfileId,
  targetProfileId: ProfileId,
  note?: string,
): Promise<ShortlistItem> {
  if (profileId === targetProfileId) {
    throw serviceError('SELF_SHORTLIST', 'Cannot shortlist yourself');
  }

  const [row] = await db
    .insert(shortlists)
    .values({ profileId, targetProfileId, note: note ?? null })
    .onConflictDoNothing()
    .returning();

  // If onConflictDoNothing fired, fetch the existing row instead
  const existing = row ?? await (async () => {
    const [found] = await db
      .select()
      .from(shortlists)
      .where(and(eq(shortlists.profileId, profileId), eq(shortlists.targetProfileId, targetProfileId)))
      .limit(1);
    return found;
  })();

  if (!existing) {
    throw serviceError('INSERT_FAILED', 'Failed to create shortlist entry');
  }

  // Enrich with target profile public fields
  const enriched = await enrichOne(existing as RawShortlistRow);
  return enriched;
}

// ── removeShortlist ───────────────────────────────────────────────────────────

/**
 * Remove a shortlist bookmark.
 * Returns true if a row was deleted, false if it did not exist.
 */
export async function removeShortlist(
  profileId: ProfileId,
  targetProfileId: ProfileId,
): Promise<boolean> {
  const deleted = await db
    .delete(shortlists)
    .where(and(eq(shortlists.profileId, profileId), eq(shortlists.targetProfileId, targetProfileId)))
    .returning({ id: shortlists.id });

  return deleted.length > 0;
}

// ── listShortlists ────────────────────────────────────────────────────────────

/**
 * Return paginated shortlist items for profileId, ordered by createdAt desc.
 * Each item is enriched with the target profile's public fields.
 */
export async function listShortlists(
  profileId: ProfileId,
  page = 1,
  limit = 20,
): Promise<PaginatedShortlists> {
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(shortlists)
    .where(eq(shortlists.profileId, profileId))
    .orderBy(desc(shortlists.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(shortlists)
    .where(eq(shortlists.profileId, profileId));

  const total = Number(countRow?.count ?? 0);

  const items = await enrichMany(rows as RawShortlistRow[]);

  return { items, total, page, limit };
}

// ── isShortlisted ─────────────────────────────────────────────────────────────

export async function isShortlisted(
  profileId: ProfileId,
  targetProfileId: ProfileId,
): Promise<boolean> {
  const [row] = await db
    .select({ id: shortlists.id })
    .from(shortlists)
    .where(and(eq(shortlists.profileId, profileId), eq(shortlists.targetProfileId, targetProfileId)))
    .limit(1);

  return row !== undefined;
}

// ── Internal: enrich a raw row ────────────────────────────────────────────────

interface RawShortlistRow {
  id: string;
  profileId: string;
  targetProfileId: string;
  note: string | null;
  createdAt: Date;
}

/**
 * Batched enrichment — 3 queries TOTAL for any number of rows (was 3 serial
 * queries PER row: profile + photo + Mongo findOne). One profiles query, one
 * primary-photo `inArray` query, one mock-guarded `ProfileContent.find($in)`.
 * Output per row is identical to the old per-row enrichOne.
 */
async function enrichMany(rows: RawShortlistRow[]): Promise<ShortlistItem[]> {
  if (rows.length === 0) return [];
  const targetIds = rows.map((r) => r.targetProfileId);

  // 1) verification status + userId for every target — ONE query
  const profileRows = await db
    .select({ id: profiles.id, verificationStatus: profiles.verificationStatus, userId: profiles.userId })
    .from(profiles)
    .where(inArray(profiles.id, targetIds));
  const profById = new Map(profileRows.map((p) => [p.id, p]));

  // 2) primary photo R2 keys for every target — ONE query
  const photoRows = await db
    .select({ profileId: profilePhotos.profileId, r2Key: profilePhotos.r2Key })
    .from(profilePhotos)
    .where(and(inArray(profilePhotos.profileId, targetIds), eq(profilePhotos.isPrimary, true)));
  const photoByProfileId = new Map<string, string | null>(
    photoRows.map((ph) => [ph.profileId, ph.r2Key ?? null]),
  );

  // 3) ProfileContent for every target's userId — ONE batched query (mock-guarded).
  // ProfileContent is keyed by Better Auth userId, NOT profiles.id — resolve via
  // the profile rows above. Mock mode leaves the map empty → null fields (legacy).
  const contentByUserId = new Map<string, ProfileContentDoc>();
  if (!shouldUseMockMongo) {
    const userIds = profileRows.map((p) => p.userId).filter((u): u is string => !!u);
    if (userIds.length > 0) {
      try {
        const docs = await ProfileContent.find({ userId: { $in: userIds } }).lean();
        for (const d of docs) if (d?.userId) contentByUserId.set(d.userId, d);
      } catch (e) {
        // Non-fatal — surface null fields rather than crashing the list
        console.error('[shortlists.enrichMany] ProfileContent batch lookup failed:', e);
      }
    }
  }

  return rows.map((row) => {
    const prof = profById.get(row.targetProfileId);
    const verificationStatus = prof?.verificationStatus ?? 'PENDING';
    const primaryPhotoKey = photoByProfileId.get(row.targetProfileId) ?? null;

    let name: string | null = null;
    let age: number | null = null;
    let city: string | null = null;
    const targetUserId = prof?.userId ?? null;
    const content = targetUserId ? contentByUserId.get(targetUserId) : undefined;
    if (content) {
      const personal = content.personal as { fullName?: string; dob?: Date } | undefined;
      const location = content.location as { city?: string } | undefined;
      name = personal?.fullName ?? null;
      age = ageFromDob(personal?.dob ?? null);
      city = location?.city ?? null;
    }

    return {
      id:                 row.id,
      profileId:          row.profileId,
      targetProfileId:    row.targetProfileId,
      note:               row.note,
      createdAt:          row.createdAt,
      name,
      age,
      city,
      primaryPhotoKey,
      verificationStatus,
    };
  });
}

/** Single-row wrapper over the batched path (used by addShortlist). */
async function enrichOne(row: RawShortlistRow): Promise<ShortlistItem> {
  const [item] = await enrichMany([row]);
  return item!;
}
