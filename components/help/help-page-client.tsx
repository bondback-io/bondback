"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { IFuseOptions, FuseResult } from "fuse.js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { HelpArticleMinimal } from "@/lib/help-articles";
import { stripMarkdownToPlainText, escapeLikePattern, expandSearchTerms } from "@/lib/help-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Highlight, HighlightByIndices } from "@/components/ui/highlight";
import { Search, X, Award, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "All",
  "Getting Started",
  "Lister Guide",
  "Cleaner Guide",
  "Payments & Earnings",
  "Disputes & Issues",
  "Account & Profile",
] as const;

const EMPTY_STATE_SUGGESTIONS = [
  "how to bid",
  "upload photos",
  "get paid",
  "reserve price",
  "dispute",
];

const DEBOUNCE_MS = 200;

const FUSE_OPTIONS: IFuseOptions<HelpArticleMinimal> = {
  keys: [
    { name: "title", weight: 0.6 },
    { name: "content", weight: 0.4 },
  ],
  threshold: 0.4,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 1,
  ignoreLocation: true,
};

const FUZZY_THRESHOLD = 0.15;

export type HelpPageClientProps = {
  initialArticles: HelpArticleMinimal[];
};

export function HelpPageClient({ initialArticles }: HelpPageClientProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [allArticles, setAllArticles] = useState<HelpArticleMinimal[]>(initialArticles);
  const [initialLoading, setInitialLoading] = useState(false);
  const [searchFallbackLoading, setSearchFallbackLoading] = useState(false);
  const [displayItems, setDisplayItems] = useState<HelpArticleMinimal[]>(initialArticles);
  const [fuseResults, setFuseResults] = useState<FuseResult<HelpArticleMinimal>[] | null>(null);
  const [usedFallbackSearch, setUsedFallbackSearch] = useState(false);
  const [showClosestMessage, setShowClosestMessage] = useState(false);

  useEffect(() => {
    setAllArticles(initialArticles);
    setDisplayItems(initialArticles);
  }, [initialArticles]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const categoryFilteredArticles = useMemo(() => {
    if (category === "All") return allArticles;
    return allArticles.filter((a) => a.category === category);
  }, [allArticles, category]);

  const fuse = useMemo(
    () => new Fuse(categoryFilteredArticles, FUSE_OPTIONS),
    [categoryFilteredArticles]
  );

  const buildSearchFilter = useCallback((term: string) => {
    const pattern = `%${escapeLikePattern(term.replace(/,/g, " ").trim())}%`;
    return `title.ilike.${pattern},content.ilike.${pattern}`;
  }, []);

  useEffect(() => {
    setUsedFallbackSearch(false);
    setShowClosestMessage(false);
    setFuseResults(null);

    if (!debouncedQuery) {
      setDisplayItems(categoryFilteredArticles);
      return;
    }

    const fuseSearchResults = fuse.search(debouncedQuery);

    if (fuseSearchResults.length > 0) {
      setDisplayItems(fuseSearchResults.map((r) => r.item));
      setFuseResults(fuseSearchResults);
      const bestScore = fuseSearchResults[0]?.score ?? 0;
      setShowClosestMessage(bestScore > FUZZY_THRESHOLD);
      return;
    }

    setSearchFallbackLoading(true);
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const termForFilter = debouncedQuery.replace(/,/g, " ").trim();
      let q = supabase
        .from("help_articles")
        .select("id, title, slug, category, content, sort_order")
        .eq("is_published", true)
        .order("category")
        .order("sort_order", { ascending: true })
        .or(buildSearchFilter(termForFilter));
      if (category !== "All") q = q.eq("category", category);

      const { data, error } = await q;
      let results = (data ?? []) as HelpArticleMinimal[];
      if (error) results = [];

      if (results.length === 0) {
        const expanded = expandSearchTerms(debouncedQuery).slice(0, 6);
        const orParts = expanded.map((t) => buildSearchFilter(t)).join(",");
        let fallbackQ = supabase
          .from("help_articles")
          .select("id, title, slug, category, content, sort_order")
          .eq("is_published", true)
          .order("category")
          .order("sort_order", { ascending: true })
          .or(orParts);
        if (category !== "All") fallbackQ = fallbackQ.eq("category", category);
        const { data: fallbackData } = await fallbackQ;
        const fallbackResults = (fallbackData ?? []) as HelpArticleMinimal[];
        if (fallbackResults.length > 0) {
          setDisplayItems(fallbackResults);
          setUsedFallbackSearch(true);
        } else {
          setDisplayItems([]);
        }
      } else {
        setDisplayItems(results);
      }
      setShowClosestMessage(false);
      setSearchFallbackLoading(false);
    })();
  }, [debouncedQuery, category, categoryFilteredArticles, fuse, buildSearchFilter]);

  const isSearching = !!query.trim();
  const showFlatResults = isSearching;
  const resultCount = displayItems.length;
  const loading = searchFallbackLoading;

  const handleClearSearch = () => {
    setQuery("");
    setDebouncedQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      handleClearSearch();
      (e.target as HTMLInputElement).blur();
    }
  };

  const byCategory = useMemo(() => {
    const map = new Map<string, HelpArticleMinimal[]>();
    for (const a of displayItems) {
      const cat = a.category || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(a);
    }
    return map;
  }, [displayItems]);

  const getMatchIndices = useCallback(
    (articleId: string, key: "title" | "content") => {
      if (!fuseResults) return [];
      const r = fuseResults.find((x) => x.item.id === articleId);
      const m = r?.matches?.find((x) => x.key === key);
      return (m?.indices ?? []) as [number, number][];
    },
    [fuseResults]
  );

  return (
    <section className="page-inner space-y-6">
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight dark:text-gray-100">
            Help &amp; Support
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground dark:text-gray-300">
              Bond Back connects listers and cleaners for bond cleaning jobs. Search with fuzzy matching or browse by category.
            </p>
            <Button asChild size="sm" className="shrink-0 gap-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">
              <Link href="/support">
                <MessageCircle className="h-4 w-4" />
                Contact Support
              </Link>
            </Button>
          </div>

          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-gray-400" aria-hidden />
            <Input
              type="search"
              placeholder="Search help articles…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-9 pr-9"
              aria-label="Search help articles"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Badge
                key={cat}
                variant={category === cat ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-colors",
                  category === cat
                    ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
                    : "hover:bg-muted dark:hover:bg-gray-800"
                )}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>

          {isSearching && (
            <div className="space-y-0.5">
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                {loading ? "Searching…" : `${resultCount} result${resultCount === 1 ? "" : "s"} for "${query.trim()}"`}
              </p>
              {showClosestMessage && resultCount > 0 && (
                <p className="text-xs text-muted-foreground dark:text-gray-500">
                  Showing closest matches for &quot;{query.trim()}&quot;
                </p>
              )}
              {usedFallbackSearch && resultCount > 0 && (
                <p className="text-xs text-muted-foreground dark:text-gray-500">
                  Search expanded to related terms to find more articles.
                </p>
              )}
            </div>
          )}

          {loading && (
            <div className="py-8 text-center text-sm text-muted-foreground dark:text-gray-400">
              Searching…
            </div>
          )}

          {!loading && resultCount === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 py-10 text-center dark:border-gray-700 dark:bg-gray-800/30">
              <p className="text-sm font-medium text-foreground dark:text-gray-200">No results found</p>
              <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
                Try: {EMPTY_STATE_SUGGESTIONS.map((s, i) => (
                  <span key={s}>
                    {i > 0 && " · "}
                    <button
                      type="button"
                      className="text-primary underline-offset-4 hover:underline"
                      onClick={() => setQuery(s)}
                    >
                      {s}
                    </button>
                  </span>
                ))}
              </p>
            </div>
          )}

          {!loading && resultCount > 0 && showFlatResults && (
            <ul className="space-y-3">
              {displayItems.map((article, index) => {
                const excerpt = stripMarkdownToPlainText(article.content);
                const titleIndices = getMatchIndices(article.id, "title");
                const isBestMatch = isSearching && index === 0;
                return (
                  <li key={article.id}>
                    <Link href={`/help/${article.slug}`}>
                      <Card className="transition-colors hover:bg-muted/50 dark:hover:bg-gray-800/50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            {isBestMatch && (
                              <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                                <Award className="h-3 w-3" />
                                Best match
                              </Badge>
                            )}
                            <p className="font-medium text-foreground dark:text-gray-100 flex-1 min-w-0">
                              {fuseResults && titleIndices.length > 0 ? (
                                <HighlightByIndices text={article.title} indices={titleIndices} />
                              ) : (
                                <Highlight text={article.title} term={query.trim()} />
                              )}
                            </p>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground dark:text-gray-400">
                            <Highlight text={excerpt} term={query.trim()} />
                          </p>
                          <Badge variant="outline" className="mt-2 text-[10px]">
                            {article.category}
                          </Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && resultCount > 0 && !showFlatResults && (
            <div className="space-y-6">
              {Array.from(byCategory.entries()).map(([cat, list]) => (
                <div key={cat}>
                  <h3 className="mb-2 text-sm font-semibold text-foreground dark:text-gray-200">{cat}</h3>
                  <ul className="space-y-2">
                    {list.map((article) => (
                      <li key={article.id}>
                        <Link
                          href={`/help/${article.slug}`}
                          className="text-sm text-primary underline-offset-4 hover:underline dark:text-primary"
                        >
                          {article.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-medium text-foreground dark:text-gray-200">Still need help?</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">
              <Link href="/support">
                <MessageCircle className="h-4 w-4" />
                Contact Support
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/notifications">Notifications</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground dark:text-gray-500">
            Or email{" "}
            <a href="mailto:support@bondback.com" className="text-primary underline-offset-4 hover:underline">
              support@bondback.com
            </a>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
