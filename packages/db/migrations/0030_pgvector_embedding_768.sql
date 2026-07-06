-- Resize profiles.ai_embedding from vector(1536) -> vector(768).
--
-- Why: the local, provider-independent embedding model
-- (sentence-transformers/paraphrase-multilingual-mpnet-base-v2) emits 768-dim
-- vectors. The 1536 dimension in 0029 was placeholder scaffolding — NOTHING has
-- ever populated the column (see apps/api/src/matchmaking/embeddingSync.ts), so
-- this resize is ZERO-data-risk: all existing values are NULL and cast cleanly.
--
-- Idempotent + additive. Apply per the CLAUDE.md production migration protocol
-- (Railway SQL console or psql). pgvector is already active in prod.
--
-- The HNSW index is bound to the column's dimension, so it must be dropped
-- before the type change and recreated after.
DROP INDEX IF EXISTS "profiles_ai_embedding_hnsw_idx";--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "ai_embedding" TYPE vector(768);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_ai_embedding_hnsw_idx" ON "profiles" USING hnsw ("ai_embedding" vector_cosine_ops);
