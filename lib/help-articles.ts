import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { FULL_ARTICLES_BY_SLUG, FULL_HELP_ARTICLES } from "@/lib/help-articles-content";

export type HelpArticleRow = Database["public"]["Tables"]["help_articles"]["Row"];

/** Minimal shape needed for Help page (id, title, slug, category, content, sort_order). Use this for props so fallback articles work. */
export type HelpArticleMinimal = Pick<HelpArticleRow, "id" | "title" | "slug" | "category" | "content" | "sort_order">;

/** Article shape for single-article page (includes optional updated_at from DB). */
export type HelpArticleForPage = HelpArticleMinimal & { updated_at?: string | null };

/**
 * Server-only. Fetches all published help articles for the Help page.
 * Uses admin client first (bypasses RLS); falls back to server client; if both fail or return empty, returns built-in full articles so the page always loads.
 */
export async function getHelpArticles(): Promise<HelpArticleMinimal[]> {
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("help_articles")
      .select("id, title, slug, category, content, sort_order")
      .eq("is_published", true)
      .order("category")
      .order("sort_order", { ascending: true });
    if (!error && data?.length) return data as HelpArticleMinimal[];
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("help_articles")
      .select("id, title, slug, category, content, sort_order")
      .eq("is_published", true)
      .order("category")
      .order("sort_order", { ascending: true });
    if (!error && data?.length) return data as HelpArticleMinimal[];
  } catch {
    // Table may not exist yet; use full in-app articles below.
  }

  return FULL_HELP_ARTICLES as HelpArticleMinimal[];
}

/**
 * Server-only. Fetches a single help article by slug for /help/[slug].
 * Tries DB first; if not found or error, returns the in-app full article so all article links work without DB.
 */
export async function getArticleBySlug(slug: string): Promise<HelpArticleForPage | null> {
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("help_articles")
      .select("id, title, slug, category, content, updated_at")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!error && data) return data as HelpArticleForPage;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("help_articles")
      .select("id, title, slug, category, content, updated_at")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!error && data) return data as HelpArticleForPage;
  } catch {
    // Table may not exist; use in-app content below.
  }

  const fallback = FULL_ARTICLES_BY_SLUG[slug];
  if (!fallback) return null;
  return {
    id: fallback.id,
    title: fallback.title,
    slug: fallback.slug,
    category: fallback.category,
    content: fallback.content,
    sort_order: fallback.sort_order,
    updated_at: null,
  };
}
