"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type HelpArticleRow = Database["public"]["Tables"]["help_articles"]["Row"];

export type VectorSearchOptions = {
  matchThreshold?: number;
  matchCount?: number;
  category?: string | null;
};

/**
 * Optional AI search: semantic search over help_articles using pgvector.
 * Requires embeddings to be populated on help_articles (e.g. via OpenAI embedding API).
 * Wire this from a route that generates the query embedding, then call this action.
 *
 * @param queryEmbedding - 1536-dim vector (e.g. OpenAI text-embedding-3-small)
 * @param options - matchThreshold (0–1), matchCount, optional category filter
 * @returns Matching help articles ordered by similarity, or [] if RPC/embeddings unavailable
 */
export async function searchHelpByVector(
  queryEmbedding: number[],
  options: VectorSearchOptions = {}
): Promise<HelpArticleRow[]> {
  const { matchThreshold = 0.5, matchCount = 10, category = null } = options;

  if (!queryEmbedding?.length || queryEmbedding.length !== 1536) {
    return [];
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any)
    .rpc("match_help_articles", {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_category: category,
    });

  if (error) {
    console.error("help-search vector RPC error:", error.message);
    return [];
  }

  return (data ?? []) as HelpArticleRow[];
}
