/**
 * Smart Shaadi — Assistant Knowledge Base Schema (RAG)
 * packages/db/schema/knowledgeBase.ts
 *
 * One row per embedded chunk of PUBLIC website content: i18n platform copy,
 * the 22 programmatic SEO pages, FAQ/legal sections, public vendor listings,
 * and subscription-plan pricing. The assistant's `search_knowledge` tool ranks
 * these by pgvector cosine similarity to ground answers in real site content.
 *
 * Deliberately has NO user_id column — chunks are global public content, so
 * the multi-tenant filter rule does not apply here. Nothing user-private may
 * ever be indexed into this table; the extractor enforces a public-field
 * allowlist (see apps/api/src/services/knowledgeIndexer.ts).
 *
 * `source_type` is plain varchar (not a pg enum) so future source types need
 * no migration. The 768 dimension matches the local sentence-transformers
 * model established by migration 0030. Migration: 0042.
 */

import {
  pgTable, uuid, varchar, text, integer, jsonb, timestamp, vector,
  index, uniqueIndex,
} from 'drizzle-orm/pg-core';

/** Values currently written by the indexer (informal — column is varchar). */
export type KnowledgeSourceType =
  | 'i18n_page'
  | 'seo_page'
  | 'vendor'
  | 'faq'
  | 'legal'
  | 'plan_pricing';

export const knowledgeChunks = pgTable('knowledge_chunks', {
  id:             uuid('id').primaryKey().defaultRandom(),
  sourceType:     varchar('source_type', { length: 32 }).notNull().$type<KnowledgeSourceType>(),
  sourceId:       varchar('source_id', { length: 256 }).notNull(),
  locale:         varchar('locale', { length: 8 }).notNull().default('en'),
  chunkIndex:     integer('chunk_index').notNull(),
  title:          text('title').notNull(),
  url:            text('url').notNull(),
  content:        text('content').notNull(),
  embedding:      vector('embedding', { dimensions: 768 }),
  contentHash:    varchar('content_hash', { length: 64 }).notNull(),
  sourceMetadata: jsonb('source_metadata').$type<Record<string, unknown>>(),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  sourceChunkUq: uniqueIndex('knowledge_chunks_source_chunk_uq')
    .on(t.sourceType, t.sourceId, t.locale, t.chunkIndex),
  sourceLocaleIdx: index('knowledge_chunks_source_locale_idx')
    .on(t.sourceType, t.locale),
  // The HNSW embedding index exists in SQL only (migration 0042) — Drizzle's
  // builder cannot express `USING hnsw (... vector_cosine_ops)`.
}));
