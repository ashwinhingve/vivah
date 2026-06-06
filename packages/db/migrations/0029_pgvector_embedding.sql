-- pgvector — 1536-dim profile embedding + HNSW cosine index.
-- Hand-edited from drizzle-kit output: prepend CREATE EXTENSION, add IF NOT EXISTS
-- guards (idempotent — safe to re-run), and the HNSW index drizzle-kit can't emit.
--
-- BEFORE APPLYING to any environment, verify the extension is available:
--   SELECT * FROM pg_available_extensions WHERE name = 'vector';
-- If absent, STOP — Railway-managed Postgres must have pgvector first.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "ai_embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "embedding_updated_at" timestamp;--> statement-breakpoint
-- HNSW index for cosine similarity. HNSW (not IVFFlat): builds on an empty /
-- incrementally-filled table with no training step. vector_cosine_ops opclass.
CREATE INDEX IF NOT EXISTS "profiles_ai_embedding_hnsw_idx" ON "profiles" USING hnsw ("ai_embedding" vector_cosine_ops);