-- 0042 — Smart Shaadi Assistant knowledge base (RAG over website content).
--
-- One row per embedded content chunk: platform copy (i18n pages), the 22
-- programmatic SEO pages, FAQ/legal sections, public vendor listings, and
-- subscription-plan pricing. The assistant's `search_knowledge` tool ranks
-- these by pgvector cosine similarity to ground answers in real site content.
--
-- Chunks are GLOBAL PUBLIC content — there is deliberately no user_id column
-- (the multi-tenant filter rule does not apply; nothing user-private may ever
-- be indexed here, enforced by the extractor's public-field allowlist).
--
-- `source_type` is plain varchar, NOT a pg enum, so future source types
-- (e.g. 'blog') need no migration. Dimension 768 matches the local
-- sentence-transformers model established by 0030.
--
-- Additive + idempotent. Apply via the Railway SQL console / psql per the
-- CLAUDE.md prod protocol. pgvector is already active in prod (0029/0030).

CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_type"     varchar(32) NOT NULL,
  "source_id"       varchar(256) NOT NULL,
  "locale"          varchar(8) NOT NULL DEFAULT 'en',
  "chunk_index"     integer NOT NULL,
  "title"           text NOT NULL,
  "url"             text NOT NULL,
  "content"         text NOT NULL,
  "embedding"       vector(768),
  "content_hash"    varchar(64) NOT NULL,
  "source_metadata" jsonb,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_chunks_source_chunk_uq"
    UNIQUE ("source_type", "source_id", "locale", "chunk_index")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "knowledge_chunks_source_locale_idx"
  ON "knowledge_chunks" ("source_type", "locale");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_hnsw_idx"
  ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);
