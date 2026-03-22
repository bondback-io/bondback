-- Optional: AI-powered help search via pgvector (embeddings).
-- Run after 20250320000000_help_articles.sql.
-- Requires embeddings to be populated (e.g. via OpenAI) before vector search returns results.

CREATE EXTENSION IF NOT EXISTS vector;

-- 1536 dimensions = OpenAI text-embedding-3-small / ada-002. Use 384 for smaller models (e.g. sentence-transformers).
ALTER TABLE public.help_articles
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_help_articles_embedding
  ON public.help_articles
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

COMMENT ON COLUMN public.help_articles.embedding IS 'Optional. Populate via embedding API (e.g. OpenAI) to enable semantic search.';

-- RPC: semantic search by query embedding. Returns published articles ordered by similarity.
CREATE OR REPLACE FUNCTION public.match_help_articles(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_category text DEFAULT NULL
)
RETURNS SETOF public.help_articles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.help_articles
  WHERE is_published = true
    AND embedding IS NOT NULL
    AND (filter_category IS NULL OR category = filter_category)
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMENT ON FUNCTION public.match_help_articles IS 'Optional AI search: returns help_articles by embedding similarity. Call with embedding from your embedding API (e.g. OpenAI).';
