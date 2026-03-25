"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  memo,
} from "react";
import Link from "next/link";
import type { FuseResult } from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { HelpArticleMinimal } from "@/lib/help-articles";
import { stripMarkdownToPlainText, escapeLikePattern, expandSearchTerms } from "@/lib/help-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Highlight, HighlightByIndices } from "@/components/ui/highlight";
import {
  Search,
  X,
  Award,
  MessageCircle,
  Sparkles,
  Home,
  Brush,
  DollarSign,
  Scale,
  User,
  BookOpen,
  ChevronRight,
  Loader2,
} from "lucide-react";
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

const CATEGORY_ICONS: Record<string, typeof Sparkles> = {
  "Getting Started": Sparkles,
  "Lister Guide": Home,
  "Cleaner Guide": Brush,
  "Payments & Earnings": DollarSign,
  "Disputes & Issues": Scale,
  "Account & Profile": User,
};

const EMPTY_STATE_SUGGESTIONS = [
  "how to bid",
  "upload photos",
  "get paid",
  "reserve price",
  "dispute",
];

const DEBOUNCE_MS = 280;

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

/** Simple client-side filter before Fuse chunk loads (fast path). */
function filterArticlesPlain(
  articles: HelpArticleMinimal[],
  q: string
): HelpArticleMinimal[] {
  const n = q.trim().toLowerCase();
  if (!n) return articles;
  return articles.filter((a) => {
    const t = a.title.toLowerCase();
    const c = stripMarkdownToPlainText(a.content).toLowerCase();
    return t.includes(n) || c.includes(n);
  });
}

const SearchResultCard = memo(function SearchResultCard({
  article,
  query,
  fuseResults,
  index,
  isSearching,
  getMatchIndices,
}: {
  article: HelpArticleMinimal;
  query: string;
  fuseResults: FuseResult<HelpArticleMinimal>[] | null;
  index: number;
  isSearching: boolean;
  getMatchIndices: (
    articleId: string,
    key: "title" | "content"
  ) => [number, number][];
}) {
  const excerpt = stripMarkdownToPlainText(article.content);
  const titleIndices = getMatchIndices(article.id, "title");
  const isBestMatch = isSearching && index === 0;

  return (
    <li>
      <Link
        href={`/help/${article.slug}`}
        className="block rounded-xl outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card className="border-border/80 bg-card/90 transition-colors hover:border-primary/30 hover:bg-muted/40 dark:border-gray-800 dark:bg-gray-900/80 dark:hover:bg-gray-800/60">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
                <BookOpen className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {isBestMatch && (
                    <Badge
                      variant="secondary"
                      className="shrink-0 gap-1 text-[10px] font-semibold"
                    >
                      <Award className="h-3 w-3" aria-hidden />
                      Best match
                    </Badge>
                  )}
                  <h3 className="text-base font-semibold leading-snug text-foreground dark:text-gray-100">
                    {fuseResults && titleIndices.length > 0 ? (
                      <HighlightByIndices
                        text={article.title}
                        indices={titleIndices}
                      />
                    ) : (
                      <Highlight text={article.title} term={query.trim()} />
                    )}
                  </h3>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
                  <Highlight text={excerpt} term={query.trim()} />
                </p>
                <Badge
                  variant="outline"
                  className="mt-2.5 text-[10px] font-medium"
                >
                  {article.category}
                </Badge>
              </div>
              <ChevronRight
                className="mt-1 h-5 w-5 shrink-0 text-muted-foreground/60"
                aria-hidden
              />
            </div>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
});

export function HelpPageClient({ initialArticles }: HelpPageClientProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [allArticles, setAllArticles] = useState<HelpArticleMinimal[]>(
    initialArticles
  );
  const [searchFallbackLoading, setSearchFallbackLoading] = useState(false);
  const [displayItems, setDisplayItems] =
    useState<HelpArticleMinimal[]>(initialArticles);
  const [fuseResults, setFuseResults] = useState<
    FuseResult<HelpArticleMinimal>[] | null
  >(null);
  const [usedFallbackSearch, setUsedFallbackSearch] = useState(false);
  const [showClosestMessage, setShowClosestMessage] = useState(false);
  const [fuseReady, setFuseReady] = useState(false);
  const [isFilterPending, startFilterTransition] = useTransition();

  const fuseRef = useRef<
    import("fuse.js").default<HelpArticleMinimal> | null
  >(null);
  const searchSeqRef = useRef(0);

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

  useEffect(() => {
    let cancelled = false;
    void import("fuse.js").then((mod) => {
      if (cancelled) return;
      fuseRef.current = new mod.default([], FUSE_OPTIONS);
      setFuseReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fuseRef.current || !fuseReady) return;
    fuseRef.current.setCollection(categoryFilteredArticles);
  }, [categoryFilteredArticles, fuseReady]);

  const buildSearchFilter = useCallback((term: string) => {
    const pattern = `%${escapeLikePattern(term.replace(/,/g, " ").trim())}%`;
    return `title.ilike.${pattern},content.ilike.${pattern}`;
  }, []);

  useEffect(() => {
    const seq = ++searchSeqRef.current;
    setUsedFallbackSearch(false);
    setShowClosestMessage(false);
    setFuseResults(null);

    if (!debouncedQuery) {
      setSearchFallbackLoading(false);
      startFilterTransition(() => {
        setDisplayItems(categoryFilteredArticles);
      });
      return;
    }

    const run = async () => {
      setSearchFallbackLoading(false);
      const fuse = fuseRef.current;
      if (!fuseReady || !fuse) {
        if (seq !== searchSeqRef.current) return;
        startFilterTransition(() => {
          setDisplayItems(filterArticlesPlain(categoryFilteredArticles, debouncedQuery));
          setFuseResults(null);
        });
        return;
      }

      fuse.setCollection(categoryFilteredArticles);
      const fuseSearchResults = fuse.search(debouncedQuery);

      if (fuseSearchResults.length > 0) {
        if (seq !== searchSeqRef.current) return;
        startFilterTransition(() => {
          setDisplayItems(fuseSearchResults.map((r) => r.item));
          setFuseResults(fuseSearchResults);
          const bestScore = fuseSearchResults[0]?.score ?? 0;
          setShowClosestMessage(bestScore > FUZZY_THRESHOLD);
        });
        return;
      }

      setSearchFallbackLoading(true);
      try {
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
        if (seq !== searchSeqRef.current) return;
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
          if (seq !== searchSeqRef.current) return;
          const fallbackResults = (fallbackData ?? []) as HelpArticleMinimal[];
          startFilterTransition(() => {
            if (fallbackResults.length > 0) {
              setDisplayItems(fallbackResults);
              setUsedFallbackSearch(true);
            } else {
              setDisplayItems([]);
            }
            setShowClosestMessage(false);
          });
        } else {
          startFilterTransition(() => {
            setDisplayItems(results);
            setShowClosestMessage(false);
          });
        }
      } finally {
        if (seq === searchSeqRef.current) setSearchFallbackLoading(false);
      }
    };

    void run();
  }, [
    debouncedQuery,
    category,
    categoryFilteredArticles,
    fuseReady,
    buildSearchFilter,
  ]);

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

  const browseCategories = useMemo(() => {
    const order = CATEGORIES.filter((c) => c !== "All");
    return order
      .map((c) => ({
        name: c,
        articles: byCategory.get(c) ?? [],
        Icon: CATEGORY_ICONS[c] ?? BookOpen,
      }))
      .filter((x) => x.articles.length > 0);
  }, [byCategory]);

  const defaultAccordionOpen = useMemo(() => {
    const first = browseCategories[0]?.name;
    return first ? [first] : [];
  }, [browseCategories]);

  return (
    <section className="page-inner space-y-6 pb-24 md:pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-sky-500/10 via-card to-emerald-500/10 px-4 py-8 shadow-sm dark:border-gray-800 dark:from-sky-950/40 dark:via-gray-950 dark:to-emerald-950/30 sm:px-6 sm:py-10">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/10"
          aria-hidden
        />
        <nav
          aria-label="Breadcrumb"
          className="mb-4 text-xs text-muted-foreground dark:text-gray-400"
        >
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                href="/"
                className="hover:text-foreground hover:underline dark:hover:text-gray-200"
              >
                Home
              </Link>
            </li>
            <li aria-hidden className="text-muted-foreground/50">
              /
            </li>
            <li className="font-medium text-foreground dark:text-gray-200">
              Help
            </li>
          </ol>
        </nav>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-50 sm:text-3xl">
              Help &amp; Support
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-gray-400 sm:text-base">
              Guides for bond cleaning, bidding, payments, and disputes. Search
              below or browse by topic.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="hidden w-full shrink-0 gap-2 bg-emerald-600 hover:bg-emerald-700 sm:inline-flex sm:w-auto dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Link href="/support">
              <MessageCircle className="h-4 w-4" aria-hidden />
              Contact support
            </Link>
          </Button>
        </div>
      </div>

      {/* Search + filters */}
      <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm dark:border-gray-800 dark:bg-gray-900/90">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground dark:text-gray-500 sm:h-4 sm:w-4"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search help articles…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[48px] w-full border-border/80 bg-background pl-11 pr-11 text-base shadow-inner dark:bg-gray-950/50 sm:min-h-10 sm:pl-10 sm:text-sm md:pl-10"
              aria-label="Search help articles"
              autoComplete="off"
              enterKeyHint="search"
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                <X className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            ) : null}
          </div>

          <div className="relative -mx-1">
            <div
              className="flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Help categories"
            >
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "shrink-0 snap-start rounded-full border px-3.5 py-2 text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 sm:py-1.5",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border/80 bg-muted/40 text-foreground hover:bg-muted dark:border-gray-700 dark:bg-gray-800/60 dark:hover:bg-gray-800"
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {isSearching && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground dark:text-gray-400">
              {loading || isFilterPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Searching…
                </span>
              ) : (
                <span>
                  {resultCount} result{resultCount === 1 ? "" : "s"} for &quot;
                  {query.trim()}&quot;
                </span>
              )}
              {showClosestMessage && resultCount > 0 && !loading && (
                <span className="text-xs text-muted-foreground/90 dark:text-gray-500">
                  Showing closest matches.
                </span>
              )}
              {usedFallbackSearch && resultCount > 0 && !loading && (
                <span className="text-xs text-muted-foreground/90 dark:text-gray-500">
                  Expanded to related terms.
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}

      {!loading && resultCount === 0 && (
        <Card className="border-dashed border-border/80 dark:border-gray-700">
          <CardContent className="py-12 text-center sm:py-14">
            <p className="text-base font-semibold text-foreground dark:text-gray-100">
              No results found
            </p>
            <p className="mt-2 text-sm text-muted-foreground dark:text-gray-400">
              Try:{" "}
              {EMPTY_STATE_SUGGESTIONS.map((s, i) => (
                <span key={s}>
                  {i > 0 && " · "}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => setQuery(s)}
                  >
                    {s}
                  </button>
                </span>
              ))}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && resultCount > 0 && showFlatResults && (
        <ul className="space-y-3 sm:space-y-4">
          {displayItems.map((article, index) => (
            <SearchResultCard
              key={article.id}
              article={article}
              query={query}
              fuseResults={fuseResults}
              index={index}
              isSearching={isSearching}
              getMatchIndices={getMatchIndices}
            />
          ))}
        </ul>
      )}

      {!loading && resultCount > 0 && !showFlatResults && (
        <>
          {/* Mobile: accordion by category */}
          <div className="md:hidden">
            <Accordion
              key={category}
              type="multiple"
              defaultValue={defaultAccordionOpen}
              className="divide-y divide-border rounded-xl border border-border/80 bg-card dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900/80"
            >
              {browseCategories.map(({ name, articles, Icon }) => (
                <AccordionItem key={name} value={name} className="border-0 px-1">
                  <AccordionTrigger className="px-4 text-left hover:no-underline">
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="flex flex-col items-start gap-0.5">
                        <span className="text-base font-semibold">{name}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {articles.length} article
                          {articles.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-2">
                    <ul className="space-y-1 border-t border-border/60 pt-3 dark:border-gray-800">
                      {articles.map((article) => (
                        <li key={article.id}>
                          <Link
                            href={`/help/${article.slug}`}
                            className="flex min-h-[48px] items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted/60 dark:text-sky-400 dark:hover:bg-gray-800/80"
                          >
                            <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                            <span className="min-w-0 flex-1">{article.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Desktop: open sections */}
          <div className="hidden space-y-8 md:block">
            {browseCategories.map(({ name, articles, Icon }) => (
              <section
                key={name}
                className="rounded-xl border border-border/80 bg-card/50 p-5 dark:border-gray-800 dark:bg-gray-900/40"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground dark:text-gray-100">
                      {name}
                    </h2>
                    <p className="text-xs text-muted-foreground dark:text-gray-500">
                      {articles.length} article{articles.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {articles.map((article) => (
                    <li key={article.id}>
                      <Link
                        href={`/help/${article.slug}`}
                        className="flex min-h-[44px] items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-border hover:bg-muted/50 dark:text-sky-400 dark:hover:border-gray-700 dark:hover:bg-gray-800/50"
                      >
                        <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                        <span className="line-clamp-2">{article.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <Card className="border-border/80 dark:border-gray-800">
        <CardContent className="p-5 sm:p-6">
          <p className="text-sm font-semibold text-foreground dark:text-gray-100">
            Still need help?
          </p>
          <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
            Our team can help with account, payments, and job issues.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Link href="/support">
                <MessageCircle className="h-4 w-4" aria-hidden />
                Contact support
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground dark:text-gray-500">
            Email{" "}
            <a
              href="mailto:support@bondback.com"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              support@bondback.com
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Mobile FAB — contact support */}
      <div className="fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] right-4 z-30 md:hidden">
        <Button
          asChild
          size="lg"
          className="h-14 gap-2 rounded-full bg-emerald-600 px-5 shadow-lg shadow-emerald-950/30 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <Link href="/support" aria-label="Contact support">
            <MessageCircle className="h-5 w-5" aria-hidden />
            <span className="font-semibold">Help</span>
          </Link>
        </Button>
      </div>
    </section>
  );
}
