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

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { env } from '../../lib/env.js';
import { shortlists, profiles, profilePhotos } from '@smartshaadi/db';
import { ProfileContent as ProfileContentModel } from '../../infrastructure/mongo/models/ProfileContent.js';

// ProfileContent is exported as `unknown` to prevent re-registration issues.
// Cast it here to the minimal interface we need.
interface IProfileContent {
  findOne(filter: Record<string, unknown>): { lean(): Promise<ProfileContentDoc | null> };
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
  profileId: string,
  targetProfileId: string,
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
  profileId: string,
  targetProfileId: string,
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
  profileId: string,
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

  const items = await Promise.all((rows as RawShortlistRow[]).map(enrichOne));

  return { items, total, page, limit };
}

// ── isShortlisted ─────────────────────────────────────────────────────────────

export async function isShortlisted(
  profileId: string,
  targetProfileId: string,
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

async function enrichOne(row: RawShortlistRow): Promise<ShortlistItem> {
  const targetId = row.targetProfileId;

  // Fetch verification status from Postgres profiles table
  const [profileRow] = await db
    .select({ verificationStatus: profiles.verificationStatus })
    .from(profiles)
    .where(eq(profiles.id, targetId))
    .limit(1);

  const verificationStatus = profileRow?.verificationStatus ?? 'PENDING';

  // Fetch primary photo R2 key
  const [photoRow] = await db
    .select({ r2Key: profilePhotos.r2Key })
    .from(profilePhotos)
    .where(and(eq(profilePhotos.profileId, targetId), eq(profilePhotos.isPrimary, true)))
    .limit(1);

  const primaryPhotoKey = photoRow?.r2Key ?? null;

  // Fetch name, dob, city from MongoDB ProfileContent (mock-guarded)
  let name: string | null = null;
  let age: number | null = null;
  let city: string | null = null;

  if (env.USE_MOCK_SERVICES) {
    // In mock mode, MongoDB is not connected — return null fields
    name = null;
    age = null;
    city = null;
  } else {
    try {
      // ProfileContent is keyed by the profile's mongo_profile_id; we look up
      // by the postgres profile id stored in the document's profileId field.
      const content = await ProfileContent.findOne({ profileId: targetId }).lean();
      if (content) {
        const personal = content.personal as {
          fullName?: string;
          dob?: Date;
        } | undefined;
        const location = content.location as { city?: string } | undefined;
        name = personal?.fullName ?? null;
        age = ageFromDob(personal?.dob ?? null);
        city = location?.city ?? null;
      }
    } catch (e) {
      // Non-fatal — surface null fields rather than crashing the list
      console.error('[shortlists.enrichOne] ProfileContent lookup failed:', e);
    }
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
}
