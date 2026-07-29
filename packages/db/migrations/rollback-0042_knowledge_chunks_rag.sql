-- rollback-0042_knowledge_chunks_rag.sql
-- Reverses 0042 completely. knowledge_chunks holds only re-derivable public
-- content (regenerated from packages/content snapshots + vendor/plan rows by
-- the reindex-knowledge job), so dropping it loses nothing that a single
-- full reindex cannot recreate.

DROP INDEX IF EXISTS knowledge_chunks_embedding_hnsw_idx;
DROP INDEX IF EXISTS knowledge_chunks_source_locale_idx;
DROP TABLE IF EXISTS knowledge_chunks;
