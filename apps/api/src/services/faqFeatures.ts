/**
 * faqFeatures.ts — Feature extraction for the Function Attendance Quotient (FAQ).
 *
 * Extracts guest-level features from PostgreSQL for each invited guest per ceremony.
 * All features are mapped to the canonical string values the Python FAQ classifier
 * expects. Pure PG — no MongoDB, no mock-guard needed.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { guests, ceremonies, guestCeremonyInvites } from '@smartshaadi/db';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FaqInput {
  relationship_type: 'close_family' | 'extended_family' | 'colleague' | 'friend';
  /**
   * FAQ v1: stub neutral distance until guest geocoding ships.
   * guests table has no lat/lon yet — always 750 km (normalized → 0.5 in Python).
   */
  distance_km: number;
  rsvp_response: 'yes' | 'no' | 'maybe' | 'pending';
  ceremony_type: 'sangeet' | 'mehndi' | 'reception' | 'wedding';
  historical_attendance_rate: number | null;
}

export interface FaqFeatureRow {
  guestId: string;
  guestName: string;
  ceremonyId: string;
  input: FaqInput;
  rsvpRaw: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapRelationshipType(raw: string | null | undefined): FaqInput['relationship_type'] {
  if (!raw) return 'friend';
  const lower = raw.toLowerCase();
  if (lower.includes('parent') || lower.includes('sibling') || (lower.includes('family') && !lower.includes('extended'))) {
    return 'close_family';
  }
  if (
    lower.includes('cousin') || lower.includes('aunt') || lower.includes('uncle') ||
    lower.includes('nephew') || lower.includes('niece') || lower.includes('grandparent') ||
    lower.includes('extended')
  ) {
    return 'extended_family';
  }
  if (lower.includes('colleague') || lower.includes('coworker') || lower.includes('boss') || lower.includes('work')) {
    return 'colleague';
  }
  return 'friend';
}

function mapRsvpResponse(raw: string | null | undefined): FaqInput['rsvp_response'] {
  switch ((raw ?? '').toUpperCase()) {
    case 'YES':     return 'yes';
    case 'NO':      return 'no';
    case 'MAYBE':   return 'maybe';
    case 'PENDING':
    default:        return 'pending';
  }
}

function mapCeremonyType(raw: string | null | undefined): FaqInput['ceremony_type'] {
  switch ((raw ?? '').toUpperCase()) {
    case 'SANGEET':     return 'sangeet';
    case 'MEHNDI':      return 'mehndi';
    case 'RECEPTION':   return 'reception';
    case 'WEDDING':
    case 'HALDI':
    case 'ENGAGEMENT':
    case 'CORPORATE':
    case 'FESTIVAL':
    case 'COMMUNITY':
    case 'GOVERNMENT':
    case 'SCHOOL':
    case 'OTHER':
    default:            return 'wedding';
  }
}

// ── Main extractors ───────────────────────────────────────────────────────────

/**
 * Extract FAQ feature rows for all guests invited to a specific ceremony.
 *
 * @param weddingId  The wedding this ceremony belongs to (used to scope the query)
 * @param ceremonyId The specific ceremony to extract guests for
 */
export async function extract(
  weddingId: string,
  ceremonyId: string,
): Promise<FaqFeatureRow[]> {
  const rows = await db
    .select({
      guestId:                   guests.id,
      guestName:                 guests.name,
      guestRelationship:         guests.relationship,
      historicalAttendanceRate:  guests.historicalAttendanceRate,
      rsvpStatus:                guestCeremonyInvites.rsvpStatus,
      ceremonyId:                ceremonies.id,
      ceremonyType:              ceremonies.type,
    })
    .from(guests)
    .innerJoin(guestCeremonyInvites, eq(guestCeremonyInvites.guestId, guests.id))
    .innerJoin(ceremonies, eq(ceremonies.id, guestCeremonyInvites.ceremonyId))
    .where(
      and(
        eq(ceremonies.id, ceremonyId),
        eq(ceremonies.weddingId, weddingId),
      ),
    );

  return rows.map((row): FaqFeatureRow => ({
    guestId:   row.guestId,
    guestName: row.guestName,
    ceremonyId: row.ceremonyId,
    rsvpRaw:   row.rsvpStatus,
    input: {
      relationship_type:          mapRelationshipType(row.guestRelationship),
      // FAQ v1: stub neutral distance until guest geocoding ships.
      distance_km:                750,
      rsvp_response:              mapRsvpResponse(row.rsvpStatus),
      ceremony_type:              mapCeremonyType(row.ceremonyType),
      historical_attendance_rate: row.historicalAttendanceRate !== null
        ? parseFloat(row.historicalAttendanceRate as unknown as string)
        : null,
    },
  }));
}

/**
 * Extract FAQ feature rows for ALL ceremonies in a wedding.
 * Returns a Map keyed by ceremonyId for efficient summary-endpoint use.
 * One query, grouped in Node — avoids N+1.
 *
 * @param weddingId  The wedding to extract all ceremony guest features for
 */
export async function extractAllForWedding(
  weddingId: string,
): Promise<Map<string, FaqFeatureRow[]>> {
  const rows = await db
    .select({
      guestId:                   guests.id,
      guestName:                 guests.name,
      guestRelationship:         guests.relationship,
      historicalAttendanceRate:  guests.historicalAttendanceRate,
      rsvpStatus:                guestCeremonyInvites.rsvpStatus,
      ceremonyId:                ceremonies.id,
      ceremonyType:              ceremonies.type,
    })
    .from(guests)
    .innerJoin(guestCeremonyInvites, eq(guestCeremonyInvites.guestId, guests.id))
    .innerJoin(ceremonies, eq(ceremonies.id, guestCeremonyInvites.ceremonyId))
    .where(eq(ceremonies.weddingId, weddingId));

  const result = new Map<string, FaqFeatureRow[]>();

  for (const row of rows) {
    const entry: FaqFeatureRow = {
      guestId:   row.guestId,
      guestName: row.guestName,
      ceremonyId: row.ceremonyId,
      rsvpRaw:   row.rsvpStatus,
      input: {
        relationship_type:          mapRelationshipType(row.guestRelationship),
        // FAQ v1: stub neutral distance until guest geocoding ships.
        distance_km:                750,
        rsvp_response:              mapRsvpResponse(row.rsvpStatus),
        ceremony_type:              mapCeremonyType(row.ceremonyType),
        historical_attendance_rate: row.historicalAttendanceRate !== null
          ? parseFloat(row.historicalAttendanceRate as unknown as string)
          : null,
      },
    };

    const existing = result.get(row.ceremonyId);
    if (existing) {
      existing.push(entry);
    } else {
      result.set(row.ceremonyId, [entry]);
    }
  }

  return result;
}
