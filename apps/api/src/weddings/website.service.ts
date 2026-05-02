/**
 * Smart Shaadi — Public wedding website
 *
 * Couple can publish a public landing page for guests with story, schedule,
 * gallery, RSVP, registry, and Q&A. Slug-based public read; password gate
 * supported.
 */

import { eq, and, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../lib/db.js';
import {
  weddingWebsites,
  weddings,
  ceremonies,
  weddingMoodBoardItems,
  giftRegistryItems,
} from '@smartshaadi/db';
import type {
  WeddingWebsite,
  WeddingWebsiteSection,
  RegistryItem,
} from '@smartshaadi/types';
import type { UpsertWebsiteInput } from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';
import { getPhotoUrl } from '../storage/service.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

function hashPassword(plain: string): string {
  return createHash('sha256').update(`vivah-site:${plain}`).digest('hex');
}

async function toDto(r: typeof weddingWebsites.$inferSelect): Promise<WeddingWebsite> {
  return {
    id:               r.id,
    weddingId:        r.weddingId,
    slug:             r.slug,
    title:            r.title,
    story:            r.story,
    heroImageKey:     r.heroImageKey,
    heroImageUrl:     r.heroImageKey ? await getPhotoUrl(r.heroImageKey, 1800).catch(() => null) : null,
    theme:            (r.theme as WeddingWebsite['theme']) ?? null,
    sections:         (r.sections as WeddingWebsiteSection[] | null) ?? [],
    isPublic:         r.isPublic,
    passwordProtected: !!r.passwordHash,
    rsvpEnabled:      r.rsvpEnabled,
    registryEnabled:  r.registryEnabled,
    customDomain:     r.customDomain,
    viewCount:        r.viewCount,
    publishedAt:      r.publishedAt ? r.publishedAt.toISOString() : null,
    createdAt:        r.createdAt.toISOString(),
    updatedAt:        r.updatedAt.toISOString(),
  };
}

export async function getWebsite(weddingId: string, userId: string): Promise<WeddingWebsite | null> {
  await requireRole(weddingId, userId, 'VIEWER');
  const [r] = await db.select().from(weddingWebsites)
    .where(eq(weddingWebsites.weddingId, weddingId)).limit(1);
  return r ? toDto(r) : null;
}

export async function upsertWebsite(
  weddingId: string,
  userId: string,
  input: UpsertWebsiteInput,
): Promise<WeddingWebsite> {
  await requireRole(weddingId, userId, 'EDITOR');

  // Check slug uniqueness against other weddings
  const [conflict] = await db.select({ id: weddingWebsites.id, weddingId: weddingWebsites.weddingId })
    .from(weddingWebsites)
    .where(eq(weddingWebsites.slug, input.slug))
    .limit(1);
  if (conflict && conflict.weddingId !== weddingId) {
    throw appErr('Slug already taken', 'SLUG_TAKEN', 409);
  }

  const [existing] = await db.select().from(weddingWebsites)
    .where(eq(weddingWebsites.weddingId, weddingId)).limit(1);

  const passwordHash = input.password ? hashPassword(input.password) : (existing?.passwordHash ?? null);

  const values = {
    weddingId,
    slug:            input.slug,
    title:           input.title,
    story:           input.story ?? null,
    heroImageKey:    input.heroImageKey ?? null,
    theme:           input.theme ?? null,
    sections:        input.sections ?? [],
    isPublic:        input.isPublic ?? false,
    passwordHash,
    rsvpEnabled:     input.rsvpEnabled ?? true,
    registryEnabled: input.registryEnabled ?? false,
    publishedAt:     input.isPublic ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt ?? null,
    updatedAt:       new Date(),
  };

  let row;
  if (existing) {
    [row] = await db.update(weddingWebsites).set(values)
      .where(eq(weddingWebsites.id, existing.id)).returning();
  } else {
    [row] = await db.insert(weddingWebsites).values(values).returning();
  }
  if (!row) throw appErr('Save failed', 'SITE_SAVE_FAILED', 500);

  await logActivity(weddingId, userId, 'website.upsert', 'website', row.id, { slug: input.slug, isPublic: values.isPublic });
  return toDto(row);
}

// ── Public access ────────────────────────────────────────────────────────────

export interface PublicWebsiteView extends WeddingWebsite {
  ceremonies: Array<{
    type: string; date: string | null; venue: string | null;
    startTime: string | null; dressCode: string | null;
  }>;
  galleryUrls: string[];
  registry: RegistryItem[];
}

export async function getPublicWebsite(slug: string, password?: string): Promise<PublicWebsiteView | null> {
  const [siteRow] = await db.select().from(weddingWebsites)
    .where(and(eq(weddingWebsites.slug, slug), eq(weddingWebsites.isPublic, true)))
    .limit(1);
  if (!siteRow) return null;

  if (siteRow.passwordHash) {
    if (!password || hashPassword(password) !== siteRow.passwordHash) {
      throw appErr('Password required', 'PASSWORD_REQUIRED', 401);
    }
  }

  // increment view count
  await db.update(weddingWebsites).set({ viewCount: sql`${weddingWebsites.viewCount} + 1` })
    .where(eq(weddingWebsites.id, siteRow.id));

  const [w] = await db.select().from(weddings).where(eq(weddings.id, siteRow.weddingId)).limit(1);

  const cers = await db.select({
    type: ceremonies.type, date: ceremonies.date, venue: ceremonies.venue,
    startTime: ceremonies.startTime, dressCode: ceremonies.dressCode,
  }).from(ceremonies).where(eq(ceremonies.weddingId, siteRow.weddingId));

  const moodboard = await db.select({ r2Key: weddingMoodBoardItems.r2Key }).from(weddingMoodBoardItems)
    .where(eq(weddingMoodBoardItems.weddingId, siteRow.weddingId)).limit(20);
  const galleryUrls = await Promise.all(moodboard.map(m => getPhotoUrl(m.r2Key, 1800).catch(() => '')));

  const registry: RegistryItem[] = [];
  if (siteRow.registryEnabled) {
    const items = await db.select().from(giftRegistryItems)
      .where(eq(giftRegistryItems.weddingId, siteRow.weddingId));
    for (const i of items) {
      registry.push({
        id: i.id, weddingId: i.weddingId, label: i.label, description: i.description,
        price: i.price ? Number(i.price) : null, currency: i.currency,
        imageR2Key: i.imageR2Key,
        imageUrl: i.imageR2Key ? await getPhotoUrl(i.imageR2Key, 1800).catch(() => null) : null,
        externalUrl: i.externalUrl,
        status: i.status,
        claimedByName: i.claimedByName, claimedAt: i.claimedAt ? i.claimedAt.toISOString() : null,
        sortOrder: i.sortOrder,
      });
    }
  }

  const dto = await toDto(siteRow);
  void w;  // suppress unused

  return {
    ...dto,
    ceremonies: cers.map(c => ({
      type: c.type, date: c.date ?? null, venue: c.venue ?? null,
      startTime: c.startTime ?? null, dressCode: c.dressCode ?? null,
    })),
    galleryUrls: galleryUrls.filter(u => u.length > 0),
    registry,
  };
}
