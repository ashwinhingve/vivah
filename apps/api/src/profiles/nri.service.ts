/**
 * Smart Shaadi — NRI / international profile fields
 * apps/api/src/profiles/nri.service.ts
 *
 * Phase 7 Sprint G (Unit 7.2), Phase 2 integration.
 *
 * The NRI data is deliberately split across two stores, and this service is the
 * only place that knows about both:
 *   - Postgres `profiles`  — the queryable fields the matchmaking hard-filter and
 *     the NRI search facets read on every feed build.
 *   - Mongo ProfileContent.nri — descriptive text nothing filters on.
 *
 * Nothing here stores a visa number or document; `visaDetails` is free text.
 * Matching signal only, never a KYC record (CLAUDE.md).
 */

import { eq } from 'drizzle-orm';
import { profiles } from '@smartshaadi/db';
import { db } from '../lib/db.js';
import type { NriProfileFields, NriSection, ResidencyStatus, SupportedCurrency } from '@smartshaadi/types';
import type { UpdateNriProfileInput } from '@smartshaadi/schemas';
import { bustOwnFeedCache } from '../lib/redis.js';
import { updateNriSection } from './content.service.js';

export class NriServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'NriServiceError';
  }
}

/**
 * Changing any of these alters who the user matches with, so a cached feed built
 * under the old values is wrong the moment they're written.
 *
 * This is the gap Track A flagged: without the bust, a user could opt into
 * cross-border matching and see no change until the 24h feed TTL expired — and
 * would reasonably conclude the feature was broken.
 */
const MATCH_AFFECTING_FIELDS = [
  'countryOfResidence',
  'openToNriMatching',
] as const satisfies ReadonlyArray<keyof NriProfileFields>;

/** Read the Postgres-side NRI fields for a user. */
export async function getNriProfile(userId: string): Promise<NriProfileFields> {
  const [row] = await db
    .select({
      countryOfResidence: profiles.countryOfResidence,
      citizenship:        profiles.citizenship,
      residencyStatus:    profiles.residencyStatus,
      willingToRelocate:  profiles.willingToRelocate,
      openToNriMatching:  profiles.openToNriMatching,
      ianaTimezone:       profiles.ianaTimezone,
      displayCurrency:    profiles.displayCurrency,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!row) {
    throw new NriServiceError('Profile not found', 'PROFILE_NOT_FOUND', 404);
  }

  return {
    countryOfResidence: row.countryOfResidence,
    citizenship:        row.citizenship,
    residencyStatus:    row.residencyStatus as ResidencyStatus | null,
    willingToRelocate:  row.willingToRelocate,
    openToNriMatching:  row.openToNriMatching,
    ianaTimezone:       row.ianaTimezone,
    displayCurrency:    row.displayCurrency as SupportedCurrency,
  };
}

/**
 * Partial update. Filtered by `userId` so a user can only ever write their own
 * row — note `userId` (Better Auth text) is NOT `profileId` (profiles UUID), so
 * the WHERE clause matches on profiles.userId, never on an id passed by the client.
 */
export async function updateNriProfile(
  userId: string,
  input: UpdateNriProfileInput,
): Promise<NriProfileFields> {
  const { nri, ...pgFields } = input;

  // Build the SET clause from only the keys actually supplied, so an absent field
  // is left alone rather than being nulled out.
  const patch: Partial<typeof profiles.$inferInsert> = {};
  if (pgFields.countryOfResidence !== undefined) patch.countryOfResidence = pgFields.countryOfResidence;
  if (pgFields.citizenship        !== undefined) patch.citizenship        = pgFields.citizenship;
  if (pgFields.residencyStatus    !== undefined) patch.residencyStatus    = pgFields.residencyStatus;
  if (pgFields.willingToRelocate  !== undefined) patch.willingToRelocate  = pgFields.willingToRelocate;
  if (pgFields.openToNriMatching  !== undefined) patch.openToNriMatching  = pgFields.openToNriMatching;
  if (pgFields.ianaTimezone       !== undefined) patch.ianaTimezone       = pgFields.ianaTimezone;
  if (pgFields.displayCurrency    !== undefined) patch.displayCurrency    = pgFields.displayCurrency;

  if (Object.keys(patch).length > 0) {
    patch.updatedAt = new Date();
    const updated = await db
      .update(profiles)
      .set(patch)
      .where(eq(profiles.userId, userId))
      .returning({ id: profiles.id });

    if (updated.length === 0) {
      throw new NriServiceError('Profile not found', 'PROFILE_NOT_FOUND', 404);
    }
  }

  if (nri) {
    await updateNriSection(userId, nri as NriSection);
  }

  // Bust the cached feed when a match-affecting field moved. Best-effort: a
  // Redis hiccup must not fail the user's save — the feed self-heals at TTL.
  const touchedMatching = MATCH_AFFECTING_FIELDS.some((f) => pgFields[f] !== undefined);
  if (touchedMatching) {
    await bustOwnFeedCache(userId).catch((e: unknown) => {
      console.error('[nri.service] feed cache bust failed:', e);
    });
  }

  return getNriProfile(userId);
}
