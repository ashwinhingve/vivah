/**
 * Digital Invitation Builder — service layer (contract Item 16).
 *
 * Owner-facing builder + public (unauthenticated) invite view & RSVP.
 *
 * The invite stores ONLY builder state (template, message, slug, publish
 * status, rendered-PDF key). All display content (couple names, date, chosen
 * muhurat, venue, ceremonies) is read LIVE from weddings/ceremonies/Mongo —
 * never duplicated. Public RSVP self-registers into the existing `guests`
 * table; no new RSVP machinery.
 */
import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  weddings, ceremonies, guestLists, guests, profiles, weddingInvites,
} from '@smartshaadi/db';
import { shouldUseMockMongo } from '../lib/env.js';
import { mockGet } from '../lib/mockStore.js';
import { WeddingPlan } from '../infrastructure/mongo/models/WeddingPlan.js';
import { getPresignedUploadUrl, getPhotoUrl } from '../storage/service.js';
import { generateInvitePdf, type InvitePdfData } from './invite-pdf.js';

// ── ownership helpers (mirrors service.ts; kept local per module convention) ──

async function getProfileId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row?.id ?? null;
}

async function resolveOwnedWedding(
  userId: string,
  weddingId: string,
): Promise<{ id: string; profileId: string } | null> {
  const profileId = await getProfileId(userId);
  if (!profileId) return null;
  const [row] = await db
    .select({ id: weddings.id, profileId: weddings.profileId })
    .from(weddings)
    .where(and(eq(weddings.id, weddingId), eq(weddings.profileId, profileId)))
    .limit(1);
  return row?.id ? { id: row.id, profileId: row.profileId } : null;
}

function newSlug(): string {
  // URL-safe, unguessable, ~16 chars.
  return randomBytes(12).toString('base64url');
}

const planKey = (weddingId: string): string => `wedding_plan:${weddingId}`;

interface MuhuratEntry {
  date: string;
  muhurat: string;
  tithi: string | null;
  selected: boolean;
}

/** Best-effort read of the chosen muhurat from the Mongo plan (guarded per Rule 11). */
async function readSelectedMuhurat(
  weddingId: string,
): Promise<{ name: string | null; tithi: string | null }> {
  try {
    let dates: MuhuratEntry[] = [];
    if (shouldUseMockMongo) {
      const plan = mockGet(planKey(weddingId)) as { muhuratDates?: MuhuratEntry[] } | null;
      dates = plan?.muhuratDates ?? [];
    } else {
      const doc = (await WeddingPlan.findOne({ weddingId }).lean()) as
        | { muhuratDates?: MuhuratEntry[] } | null;
      dates = doc?.muhuratDates ?? [];
    }
    const chosen = dates.find((d) => d.selected);
    return { name: chosen?.muhurat ?? null, tithi: chosen?.tithi ?? null };
  } catch {
    return { name: null, tithi: null };
  }
}

// ── types ─────────────────────────────────────────────────────────────────────

export interface InviteRecord {
  id: string;
  weddingId: string;
  slug: string;
  templateId: string;
  status: 'DRAFT' | 'PUBLISHED';
  title: string | null;
  message: string | null;
  rsvpEnabled: boolean;
  assetKey: string | null;
  publishedAt: Date | null;
}

export interface PublicInviteView {
  templateId: string;
  status: 'DRAFT' | 'PUBLISHED';
  title: string | null;
  message: string | null;
  rsvpEnabled: boolean;
  brideName: string | null;
  groomName: string | null;
  weddingDate: string | null;
  venueName: string | null;
  venueCity: string | null;
  venueAddress: string | null;
  hashtag: string | null;
  primaryColor: string | null;
  muhuratName: string | null;
  muhuratTithi: string | null;
  ceremonies: Array<{
    id: string;
    type: string;
    date: string | null;
    startTime: string | null;
    venue: string | null;
  }>;
  assetUrl: string | null;
}

class InviteError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
export { InviteError };

// ── owner-facing builder ────────────────────────────────────────────────────────

export async function getInviteForWedding(
  userId: string,
  weddingId: string,
): Promise<InviteRecord | null> {
  const owned = await resolveOwnedWedding(userId, weddingId);
  if (!owned) throw new InviteError('FORBIDDEN', 'Wedding not found or not owned');

  const [row] = await db
    .select()
    .from(weddingInvites)
    .where(eq(weddingInvites.weddingId, weddingId))
    .limit(1);
  return row ?? null;
}

export async function upsertInvite(
  userId: string,
  weddingId: string,
  input: { templateId?: string | undefined; title?: string | null | undefined; message?: string | null | undefined; rsvpEnabled?: boolean | undefined },
): Promise<InviteRecord> {
  const owned = await resolveOwnedWedding(userId, weddingId);
  if (!owned) throw new InviteError('FORBIDDEN', 'Wedding not found or not owned');

  const [existing] = await db
    .select()
    .from(weddingInvites)
    .where(eq(weddingInvites.weddingId, weddingId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(weddingInvites)
      .set({
        templateId: input.templateId ?? existing.templateId,
        title: input.title === undefined ? existing.title : input.title,
        message: input.message === undefined ? existing.message : input.message,
        rsvpEnabled: input.rsvpEnabled === undefined ? existing.rsvpEnabled : input.rsvpEnabled,
        updatedAt: new Date(),
      })
      .where(eq(weddingInvites.id, existing.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(weddingInvites)
    .values({
      weddingId,
      slug: newSlug(),
      templateId: input.templateId ?? 'classic-royal',
      title: input.title ?? null,
      message: input.message ?? null,
      rsvpEnabled: input.rsvpEnabled ?? true,
    })
    .returning();
  return created!;
}

export async function publishInvite(
  userId: string,
  weddingId: string,
): Promise<InviteRecord> {
  const owned = await resolveOwnedWedding(userId, weddingId);
  if (!owned) throw new InviteError('FORBIDDEN', 'Wedding not found or not owned');

  // Ensure a row exists.
  let invite = await getInviteForWedding(userId, weddingId);
  if (!invite) invite = await upsertInvite(userId, weddingId, {});

  // Build the PDF from live wedding data.
  const view = await buildView(weddingId, invite);
  if (!view) throw new InviteError('NOT_FOUND', 'Invite data unavailable');

  const pdfData: InvitePdfData = {
    templateId: invite.templateId,
    brideName: view.brideName,
    groomName: view.groomName,
    title: invite.title,
    message: invite.message,
    weddingDate: view.weddingDate,
    muhuratName: view.muhuratName,
    muhuratTithi: view.muhuratTithi,
    venueName: view.venueName,
    venueCity: view.venueCity,
    venueAddress: view.venueAddress,
    ceremonies: view.ceremonies.map((c) => ({
      type: c.type, date: c.date, startTime: c.startTime, venue: c.venue,
    })),
  };
  const pdf = await generateInvitePdf(pdfData);

  // Upload to R2 via a presigned PUT — never stream the asset through the API.
  const { uploadUrl, r2Key } = await getPresignedUploadUrl(
    'invitations',
    `${invite.slug}.pdf`,
    'application/pdf',
  );
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: pdf,
  });
  if (!put.ok) throw new InviteError('ASSET_UPLOAD_FAILED', `R2 PUT failed (${put.status})`);

  const [updated] = await db
    .update(weddingInvites)
    .set({ status: 'PUBLISHED', assetKey: r2Key, publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(weddingInvites.id, invite.id))
    .returning();
  return updated!;
}

// ── shared view builder (keyed by wedding id) ───────────────────────────────────

interface InviteLike {
  templateId: string;
  status: 'DRAFT' | 'PUBLISHED';
  title: string | null;
  message: string | null;
  rsvpEnabled: boolean;
  assetKey: string | null;
}

const DRAFT_DEFAULTS: InviteLike = {
  templateId: 'classic-royal', status: 'DRAFT', title: null, message: null,
  rsvpEnabled: true, assetKey: null,
};

/** Compose the display view from live wedding data + the invite's own fields. */
async function buildView(weddingId: string, inv: InviteLike): Promise<PublicInviteView | null> {
  const [wedding] = await db
    .select()
    .from(weddings)
    .where(eq(weddings.id, weddingId))
    .limit(1);
  if (!wedding || wedding.deletedAt) return null;

  const ceremonyRows = await db
    .select()
    .from(ceremonies)
    .where(eq(ceremonies.weddingId, wedding.id));

  const muhurat = await readSelectedMuhurat(wedding.id);
  const assetUrl = inv.assetKey ? await getPhotoUrl(inv.assetKey) : null;

  type CeremonyRow = typeof ceremonyRows[number];
  return {
    templateId: inv.templateId,
    status: inv.status,
    title: inv.title,
    message: inv.message,
    rsvpEnabled: inv.rsvpEnabled,
    brideName: wedding.brideName,
    groomName: wedding.groomName,
    weddingDate: wedding.weddingDate,
    venueName: wedding.venueName,
    venueCity: wedding.venueCity,
    venueAddress: wedding.venueAddress,
    hashtag: wedding.hashtag,
    primaryColor: wedding.primaryColor,
    muhuratName: muhurat.name,
    muhuratTithi: muhurat.tithi,
    ceremonies: ceremonyRows
      .slice()
      .sort((a: CeremonyRow, b: CeremonyRow) => (a.date ?? '').localeCompare(b.date ?? ''))
      .map((c: CeremonyRow) => ({
        id: c.id, type: c.type, date: c.date, startTime: c.startTime, venue: c.venue,
      })),
    assetUrl,
  };
}

export async function getPublicInvite(slug: string): Promise<PublicInviteView | null> {
  const [invite] = await db
    .select()
    .from(weddingInvites)
    .where(eq(weddingInvites.slug, slug))
    .limit(1);
  if (!invite || invite.status !== 'PUBLISHED') return null;
  return buildView(invite.weddingId, invite);
}

/** Owner-side: current invite record + a live preview view (works pre-publish). */
export async function getInvitePreview(
  userId: string,
  weddingId: string,
): Promise<{ invite: InviteRecord | null; preview: PublicInviteView | null }> {
  const owned = await resolveOwnedWedding(userId, weddingId);
  if (!owned) throw new InviteError('FORBIDDEN', 'Wedding not found or not owned');
  const [invite] = await db
    .select()
    .from(weddingInvites)
    .where(eq(weddingInvites.weddingId, weddingId))
    .limit(1);
  const inv: InviteLike = invite ?? DRAFT_DEFAULTS;
  const preview = await buildView(weddingId, inv);
  return { invite: invite ?? null, preview };
}

// ── public RSVP — self-registration into the existing guests table ───────────────

// Lightweight in-memory throttle: cap submissions per slug per window. Best-
// effort spam guard; phone dedupe below is the real correctness boundary.
const rsvpHits = new Map<string, number[]>();
const RSVP_WINDOW_MS = 60_000;
const RSVP_MAX_PER_WINDOW = 20;

function throttled(slug: string): boolean {
  const now = Date.now();
  const hits = (rsvpHits.get(slug) ?? []).filter((t) => now - t < RSVP_WINDOW_MS);
  if (hits.length >= RSVP_MAX_PER_WINDOW) {
    rsvpHits.set(slug, hits);
    return true;
  }
  hits.push(now);
  rsvpHits.set(slug, hits);
  return false;
}

export interface PublicRsvpInput {
  name: string;
  phone?: string | undefined;
  email?: string | undefined;
  attending: 'YES' | 'NO' | 'MAYBE';
  plusOnes?: number | undefined;
  mealPreference?: string | undefined;
  message?: string | undefined;
}

export async function submitPublicInviteRsvp(
  slug: string,
  input: PublicRsvpInput,
): Promise<{ ok: true; created: boolean }> {
  if (throttled(slug)) throw new InviteError('RATE_LIMITED', 'Too many submissions, try again shortly');

  const [invite] = await db
    .select()
    .from(weddingInvites)
    .where(eq(weddingInvites.slug, slug))
    .limit(1);
  if (!invite || invite.status !== 'PUBLISHED') throw new InviteError('NOT_FOUND', 'Invite not found');
  if (!invite.rsvpEnabled) throw new InviteError('RSVP_DISABLED', 'RSVP is closed for this invite');

  const [wedding] = await db
    .select({ id: weddings.id, profileId: weddings.profileId, deletedAt: weddings.deletedAt })
    .from(weddings)
    .where(eq(weddings.id, invite.weddingId))
    .limit(1);
  if (!wedding || wedding.deletedAt) throw new InviteError('NOT_FOUND', 'Wedding not found');

  // Resolve (or create) the wedding's guest list. createdBy = owner userId.
  let [list] = await db
    .select({ id: guestLists.id })
    .from(guestLists)
    .where(eq(guestLists.weddingId, wedding.id))
    .limit(1);

  if (!list) {
    const [owner] = await db
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(eq(profiles.id, wedding.profileId))
      .limit(1);
    if (!owner) throw new InviteError('NOT_FOUND', 'Wedding owner not found');
    const [created] = await db
      .insert(guestLists)
      .values({ weddingId: wedding.id, createdBy: owner.userId })
      .returning({ id: guestLists.id });
    list = created!;
  }

  const meal = (input.mealPreference as typeof guests.$inferInsert.mealPreference) ?? 'NO_PREFERENCE';
  const phone = input.phone?.trim() || null;

  // Dedupe by (guestList, phone) so the same guest re-submitting updates their
  // row instead of creating duplicates. No phone → always a new row.
  if (phone) {
    const [existing] = await db
      .select({ id: guests.id })
      .from(guests)
      .where(and(eq(guests.guestListId, list.id), eq(guests.phone, phone)))
      .limit(1);
    if (existing) {
      await db
        .update(guests)
        .set({
          name: input.name,
          email: input.email ?? null,
          rsvpStatus: input.attending,
          mealPreference: meal,
          plusOnes: input.plusOnes ?? 0,
          notes: input.message ?? null,
          updatedAt: new Date(),
        })
        .where(eq(guests.id, existing.id));
      return { ok: true, created: false };
    }
  }

  await db.insert(guests).values({
    guestListId: list.id,
    name: input.name,
    phone,
    email: input.email ?? null,
    rsvpStatus: input.attending,
    mealPreference: meal,
    plusOnes: input.plusOnes ?? 0,
    notes: input.message ?? null,
  });
  return { ok: true, created: true };
}
