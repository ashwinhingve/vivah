/**
 * Smart Shaadi — Assistant knowledge-base indexer (RAG)
 *
 * Keeps the knowledge_chunks table (migration 0042) in sync with public
 * website content so the assistant's `search_knowledge` tool can ground
 * answers in real site copy.
 *
 * Sources:
 *   static  — @smartshaadi/content committed snapshot (i18n pages en+hi,
 *             22 SEO pages, FAQ, legal)
 *   dynamic — approved+active vendors and active subscription plans read from
 *             Postgres. PUBLIC FIELDS ONLY (Rule 5): the vendor extractor
 *             never touches phone/email/instagram/website.
 *
 * Pipeline per document: chunk (~1800 chars on paragraph boundaries) →
 * sha256 per chunk → diff against existing rows → embed only new/changed
 * chunks via ai-service POST /ai/embedding/batch → upsert on the
 * (source_type, source_id, locale, chunk_index) unique key → delete rows past
 * the new chunk count and rows whose source vanished. A no-change run does
 * zero embedding calls, which is what makes the nightly cron nearly free.
 *
 * knowledge_chunks is global public content — the no-userId-filter exception
 * is intentional (see packages/db/schema/knowledgeBase.ts).
 */
import { createHash } from 'node:crypto';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { knowledgeChunks, plans, vendors, type KnowledgeSourceType } from '@smartshaadi/db';
import { loadContentDocs } from '@smartshaadi/content';
import { db } from '../lib/db.js';
import { callAiService } from '../lib/ai.js';
import { getEntitlements } from '../lib/entitlements.js';

/**
 * Superset of @smartshaadi/content's ContentDoc: dynamic sources (vendors)
 * use sourceTypes the static snapshot never emits.
 */
interface IndexableDoc {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  locale: string;
  title: string;
  url: string;
  body: string;
}

export const KNOWLEDGE_EMBEDDING_DIMS = 768;

/** ~200–400 tokens at ~4.5 chars/token. */
const CHUNK_TARGET_CHARS = 1800;
const EMBED_BATCH_SIZE = 64;

export interface KnowledgeChunkInput {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  locale: string;
  chunkIndex: number;
  title: string;
  url: string;
  content: string;
  sourceMetadata?: Record<string, unknown> | undefined;
}

export interface IndexRunResult {
  embedded: number;
  unchanged: number;
  deleted: number;
  errors: number;
}

interface BatchEmbeddingResponse {
  embeddings?: number[][];
  dims?: number;
  available?: boolean;
}

// ── Chunking ─────────────────────────────────────────────────────────────────

/**
 * Split a document body into ~CHUNK_TARGET_CHARS pieces on paragraph (then
 * line) boundaries so no sentence is cut mid-way. Exported for tests.
 */
export function chunkBody(body: string, targetChars = CHUNK_TARGET_CHARS): string[] {
  const paragraphs = body.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current && current.length + para.length + 1 > targetChars) {
      chunks.push(current);
      current = '';
    }
    // A single paragraph longer than the target is hard-split.
    if (para.length > targetChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < para.length; i += targetChars) {
        chunks.push(para.slice(i, i + targetChars));
      }
      continue;
    }
    current = current ? `${current}\n${para}` : para;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function docToChunks(doc: IndexableDoc, metadata?: Record<string, unknown>): KnowledgeChunkInput[] {
  return chunkBody(doc.body).map((content, chunkIndex) => ({
    sourceType: doc.sourceType,
    sourceId: doc.sourceId,
    locale: doc.locale,
    chunkIndex,
    title: doc.title,
    url: doc.url,
    content,
    sourceMetadata: metadata,
  }));
}

// ── Dynamic sources (Postgres) ───────────────────────────────────────────────

const CONTACT_PATTERN = /(\+?\d[\d\s-]{8,}\d)|([\w.+-]+@[\w-]+\.\w{2,})/;

/**
 * One doc per approved+active vendor. Explicit public-field allowlist —
 * businessName, category, city/state, verified, rating, tagline, description,
 * years active, price band. NEVER phone/email/instagram/website.
 */
async function buildVendorDocs(vendorId?: string): Promise<IndexableDoc[]> {
  const where = vendorId
    ? and(eq(vendors.id, vendorId), eq(vendors.isActive, true), eq(vendors.status, 'APPROVED'))
    : and(eq(vendors.isActive, true), eq(vendors.status, 'APPROVED'));

  const rows = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      category: vendors.category,
      city: vendors.city,
      state: vendors.state,
      verified: vendors.verified,
      rating: vendors.rating,
      totalReviews: vendors.totalReviews,
      tagline: vendors.tagline,
      description: vendors.description,
      yearsActive: vendors.yearsActive,
      priceMin: vendors.priceMin,
      priceMax: vendors.priceMax,
    })
    .from(vendors)
    .where(where);

  return rows.map((v) => {
    const parts: string[] = [
      `${v.businessName} — ${v.category.toLowerCase().replace(/_/g, ' ')} vendor in ${v.city}, ${v.state}.`,
    ];
    if (v.tagline) parts.push(v.tagline);
    if (v.description) parts.push(v.description);
    if (v.verified) parts.push('Verified vendor.');
    if (v.rating && Number(v.rating) > 0) {
      parts.push(`Rated ${Number(v.rating).toFixed(1)}/5 from ${v.totalReviews} reviews.`);
    }
    if (v.yearsActive) parts.push(`${v.yearsActive} years in business.`);
    if (v.priceMin && v.priceMax) {
      parts.push(`Price range ₹${Number(v.priceMin).toLocaleString('en-IN')} – ₹${Number(v.priceMax).toLocaleString('en-IN')}.`);
    }
    // Defense in depth: drop any sentence that smells like contact info.
    const body = parts.filter((p) => !CONTACT_PATTERN.test(p)).join('\n');
    return {
      sourceType: 'vendor' as const,
      sourceId: v.id,
      locale: 'en' as const,
      title: `${v.businessName} — ${v.city}`,
      url: `/vendors/${v.id}`,
      body,
    };
  });
}

/**
 * One doc per active subscription plan, plus one comparison doc rendered from
 * the entitlements matrix (the single source of truth for feature gating).
 */
async function buildPlanDocs(): Promise<IndexableDoc[]> {
  const rows = await db
    .select({
      id: plans.id,
      code: plans.code,
      name: plans.name,
      tier: plans.tier,
      interval: plans.interval,
      amount: plans.amount,
      currency: plans.currency,
      features: plans.features,
    })
    .from(plans)
    .where(eq(plans.active, true));

  const docs: IndexableDoc[] = rows.map((p) => {
    const features = Array.isArray(p.features) ? (p.features as unknown[]).map(String) : [];
    const body = [
      `${p.name} plan (${p.tier}, billed ${p.interval.toLowerCase()}): ₹${Number(p.amount).toLocaleString('en-IN')} ${p.currency}.`,
      ...features.map((f) => `• ${f}`),
    ].join('\n');
    return {
      sourceType: 'plan_pricing' as const,
      sourceId: `plan-${p.code}`,
      locale: 'en' as const,
      title: `${p.name} Subscription Plan`,
      url: '/settings/billing',
      body,
    };
  });

  const tiers = ['FREE', 'STANDARD', 'PREMIUM'] as const;
  const matrixLines = tiers.map((tier) => {
    const e = getEntitlements(tier);
    const fmt = (n: number) => (Number.isFinite(n) ? String(n) : 'unlimited');
    return [
      `${tier} tier: ${fmt(e.dailyInterestLimit)} interests/day, ${fmt(e.dailyMatchViewLimit)} match views/day.`,
      e.canUseConversationCoach ? 'Includes AI Conversation Coach.' : 'No AI Conversation Coach.',
      e.canViewWhoLikedMe ? 'Can see who liked you.' : '',
      e.canViewViewers ? 'Can see profile viewers.' : '',
      e.canBoost ? 'Profile boost available.' : '',
      e.hasVerifiedBadge ? 'Verified badge included.' : '',
      e.canUploadVideoIntro ? 'Video intro uploads.' : '',
    ].filter(Boolean).join(' ');
  });
  docs.push({
    sourceType: 'plan_pricing',
    sourceId: 'tier-comparison',
    locale: 'en',
    title: 'Smart Shaadi Plan Tiers Compared',
    url: '/settings/billing',
    body: matrixLines.join('\n'),
  });

  return docs;
}

// ── Embedding + persistence ──────────────────────────────────────────────────

async function embedBatch(texts: string[]): Promise<number[][] | null> {
  const res = await callAiService<BatchEmbeddingResponse>('/ai/embedding/batch', { texts });
  const embeddings = res.embeddings;
  if (!res.available || !embeddings || embeddings.length !== texts.length) return null;
  if (embeddings.some((e) => e.length !== KNOWLEDGE_EMBEDDING_DIMS)) return null;
  return embeddings;
}

/**
 * Sync one source group (all chunks sharing source_type+source_id+locale):
 * upsert changed chunks with fresh embeddings, delete rows past the new count.
 */
async function syncChunks(chunks: KnowledgeChunkInput[]): Promise<IndexRunResult> {
  const result: IndexRunResult = { embedded: 0, unchanged: 0, deleted: 0, errors: 0 };
  const first = chunks[0];
  if (!first) return result;
  const { sourceType, sourceId, locale } = first;

  const existing = await db
    .select({
      chunkIndex: knowledgeChunks.chunkIndex,
      contentHash: knowledgeChunks.contentHash,
    })
    .from(knowledgeChunks)
    .where(and(
      eq(knowledgeChunks.sourceType, sourceType),
      eq(knowledgeChunks.sourceId, sourceId),
      eq(knowledgeChunks.locale, locale),
    ));
  const existingHashByIndex = new Map(existing.map((r) => [r.chunkIndex, r.contentHash]));

  const changed = chunks.filter(
    (c) => existingHashByIndex.get(c.chunkIndex) !== hashContent(c.content),
  );
  result.unchanged = chunks.length - changed.length;

  for (let i = 0; i < changed.length; i += EMBED_BATCH_SIZE) {
    const batch = changed.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await embedBatch(batch.map((c) => c.content));
    if (!embeddings) {
      result.errors += batch.length;
      continue;
    }
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const vector = embeddings[j];
      if (!chunk || !vector) {
        result.errors++;
        continue;
      }
      const row = {
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        locale: chunk.locale,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title,
        url: chunk.url,
        content: chunk.content,
        embedding: vector,
        contentHash: hashContent(chunk.content),
        sourceMetadata: chunk.sourceMetadata,
        updatedAt: new Date(),
      };
      try {
        await db
          .insert(knowledgeChunks)
          .values(row)
          .onConflictDoUpdate({
            target: [
              knowledgeChunks.sourceType,
              knowledgeChunks.sourceId,
              knowledgeChunks.locale,
              knowledgeChunks.chunkIndex,
            ],
            set: {
              title: row.title,
              url: row.url,
              content: row.content,
              embedding: row.embedding,
              contentHash: row.contentHash,
              sourceMetadata: row.sourceMetadata,
              updatedAt: row.updatedAt,
            },
          });
        result.embedded++;
      } catch (err) {
        console.error('[knowledgeIndexer] upsert failed', { sourceType, sourceId, err });
        result.errors++;
      }
    }
  }

  // Drop rows past the new chunk count (document shrank).
  const staleIndexes = existing
    .map((r) => r.chunkIndex)
    .filter((idx) => idx >= chunks.length);
  if (staleIndexes.length > 0) {
    await db.delete(knowledgeChunks).where(and(
      eq(knowledgeChunks.sourceType, sourceType),
      eq(knowledgeChunks.sourceId, sourceId),
      eq(knowledgeChunks.locale, locale),
      inArray(knowledgeChunks.chunkIndex, staleIndexes),
    ));
    result.deleted += staleIndexes.length;
  }

  return result;
}

function mergeResults(into: IndexRunResult, from: IndexRunResult): void {
  into.embedded += from.embedded;
  into.unchanged += from.unchanged;
  into.deleted += from.deleted;
  into.errors += from.errors;
}

/** Delete every chunk of a sourceType whose sourceId is no longer present. */
async function pruneVanishedSources(
  sourceType: KnowledgeSourceType,
  liveSourceIds: string[],
): Promise<number> {
  const rows = liveSourceIds.length > 0
    ? await db
        .delete(knowledgeChunks)
        .where(and(
          eq(knowledgeChunks.sourceType, sourceType),
          notInArray(knowledgeChunks.sourceId, liveSourceIds),
        ))
        .returning({ id: knowledgeChunks.id })
    : await db
        .delete(knowledgeChunks)
        .where(eq(knowledgeChunks.sourceType, sourceType))
        .returning({ id: knowledgeChunks.id });
  return rows.length;
}

// ── Public entry points ──────────────────────────────────────────────────────

/** Re-index one vendor (create/update) or remove its chunks (delete/unapprove). */
export async function indexVendor(vendorId: string): Promise<IndexRunResult> {
  const result: IndexRunResult = { embedded: 0, unchanged: 0, deleted: 0, errors: 0 };
  const docs = await buildVendorDocs(vendorId);
  if (docs.length === 0) {
    const deleted = await db
      .delete(knowledgeChunks)
      .where(and(
        eq(knowledgeChunks.sourceType, 'vendor'),
        eq(knowledgeChunks.sourceId, vendorId),
      ))
      .returning({ id: knowledgeChunks.id });
    result.deleted = deleted.length;
    return result;
  }
  for (const doc of docs) {
    mergeResults(result, await syncChunks(docToChunks(doc)));
  }
  return result;
}

/**
 * Full reindex: static snapshot + vendors + plans. Content-hash diffing makes
 * a no-change run embedding-free.
 *
 * Deliberately NOT gated on USE_MOCK_SERVICES: that flag mocks Razorpay/MSG91,
 * while this pipeline only needs Postgres (always real) and the ai-service
 * embedding endpoint — whose failures are counted per batch, never thrown.
 */
export async function fullReindexKnowledge(): Promise<IndexRunResult> {
  const result: IndexRunResult = { embedded: 0, unchanged: 0, deleted: 0, errors: 0 };

  const staticDocs = loadContentDocs();
  const vendorDocs = await buildVendorDocs();
  const planDocs = await buildPlanDocs();
  const allDocs = [...staticDocs, ...vendorDocs, ...planDocs];

  for (const doc of allDocs) {
    try {
      mergeResults(result, await syncChunks(docToChunks(doc)));
    } catch (err) {
      console.error('[knowledgeIndexer] doc failed', { sourceId: doc.sourceId, err });
      result.errors++;
    }
  }

  // Prune sources that vanished since the last run. Iterate every OWNED type
  // (not just types present in allDocs) so a type whose docs all disappeared
  // (e.g. every vendor unapproved) still gets its stale chunks removed.
  const OWNED_TYPES: KnowledgeSourceType[] = [
    'i18n_page', 'seo_page', 'faq', 'legal', 'plan_pricing', 'vendor',
  ];
  const byType = new Map<KnowledgeSourceType, string[]>();
  for (const doc of allDocs) {
    const list = byType.get(doc.sourceType) ?? [];
    list.push(doc.sourceId);
    byType.set(doc.sourceType, list);
  }
  for (const sourceType of OWNED_TYPES) {
    const ids = [...new Set(byType.get(sourceType) ?? [])];
    result.deleted += await pruneVanishedSources(sourceType, ids);
  }

  return result;
}
