-- Rollback for 0030_pgvector_embedding_768.sql
-- Reverses the vector(768) resize back to vector(1536) and rebuilds the HNSW
-- index. Safe because profiles.ai_embedding is entirely NULL (nothing populates
-- it yet) — the cast is a no-op on data. Apply only if 0030 must be undone.
DROP INDEX IF EXISTS "profiles_ai_embedding_hnsw_idx";
ALTER TABLE "profiles" ALTER COLUMN "ai_embedding" TYPE vector(1536);
CREATE INDEX IF NOT EXISTS "profiles_ai_embedding_hnsw_idx" ON "profiles" USING hnsw ("ai_embedding" vector_cosine_ops);
