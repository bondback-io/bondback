"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AnimatedListingCard } from "@/components/ui/ListingCard";
import {
  clampRadiusKm,
  getStoredRadiusKm,
  setStoredRadiusKm,
} from "@/lib/jobs-radius-local";
import { getListingCoverUrl } from "@/lib/listings";
import type { ListingRow } from "@/lib/listings";
import { parseUtcTimestamp } from "@/lib/utils";
import type { JobsListFilters } from "@/lib/jobs-query";
import { getJobsPage } from "@/lib/actions/jobs-list";
import type { ListerCardData } from "@/lib/lister-card-data";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { HelpCircle, Loader2, MapPin } from "lucide-react";
import { useDistanceUnit } from "@/hooks/use-distance-unit";
import { formatRadiusBannerLabel } from "@/lib/distance-format";
import { MAX_TRAVEL_KM } from "@/lib/max-travel-km";
import {
  JOBS_RADIUS_CHANGED_EVENT,
  useJobsSearchCountSetter,
} from "@/components/mobile-job-search";

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const INITIAL_PAGE_SIZE = 20;
const PRELOAD_IMAGE_COUNT = 4;
/**
 * Mobile-only: window virtualizer when list is long (keeps scroll smooth on phones).
 * Desktop always uses the CSS grid below — no change to md+ layout.
 */
const MOBILE_VIRTUALIZE_MIN = 10;
/** Default height estimate if virtualizer ever used on large viewports (unused on desktop path). */
const ESTIMATED_CARD_HEIGHT = 600;
/** Compact mobile row cards (/jobs) — tuned for cleaner card layout + title/price blocks. */
const ESTIMATED_CARD_HEIGHT_MOBILE_COMPACT = 340;

export type JobsListProps = {
  initialListings: ListingRow[];
  radiusKm?: number;
  isCleaner?: boolean;
  /** When set, cards show lister-only actions (View Bids, Edit Listing, Cancel) for listings owned by this user. */
  currentUserId?: string | null;
  /** When set, approximate distance from this point to each listing (with lat/lon) is shown on cards. */
  centerLat?: number | null;
  centerLon?: number | null;
  /** Bid count per listing id for badge (e.g. "8 bids"). */
  bidCountByListingId?: Record<string, number>;
  /** Lister display name + verification badges per listing (cleaner-facing trust on cards). */
  listerCardDataByListingId?: Record<string, ListerCardData>;
  /** When false, hide Edit Listing / Cancel Listing / View Bids on all cards (e.g. on Find Jobs search). Default: true for listers, false for cleaners. */
  showListerActions?: boolean;
  /** Filters used for this list; required for "Load more" to fetch next page. */
  filters?: JobsListFilters;
  /** When false, hide the mobile-only radius strip (e.g. when using MobileJobSearchBar). Default true. */
  showMobileRadiusStrip?: boolean;
};

export function JobsList({
  initialListings,
  radiusKm: _radiusKm = 30,
  isCleaner = false,
  currentUserId = null,
  centerLat = null,
  centerLon = null,
  bidCountByListingId: initialBidCounts = {},
  listerCardDataByListingId: initialListerCard = {},
  showListerActions,
  filters = {},
  showMobileRadiusStrip = true,
}: JobsListProps) {
  const showListerActionsResolved = showListerActions !== undefined ? showListerActions : !isCleaner;
  const [listings, setListings] = useState<ListingRow[]>(initialListings);
  const [bidCountByListingId, setBidCountByListingId] = useState<Record<string, number>>(initialBidCounts);
  const [listerCardDataByListingId, setListerCardDataByListingId] =
    useState<Record<string, ListerCardData>>(initialListerCard);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialListings.length >= INITIAL_PAGE_SIZE);
  /** Mobile-only radius (5–150 km); client filter when center lat/lon exist; persisted locally */
  const [mobileRadiusKm, setMobileRadiusKm] = useState(() =>
    clampRadiusKm(_radiusKm)
  );
  const [isMobile, setIsMobile] = useState(false);
  const supabase = createBrowserSupabaseClient();
  const { toast } = useToast();
  const distanceUnit = useDistanceUnit();
  const setJobsSearchCount = useJobsSearchCountSetter();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setMobileRadiusKm(getStoredRadiusKm(_radiusKm));
  }, [_radiusKm]);

  const loadMore = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (loadingMore || !hasMore) return;
      setLoadingMore(true);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        (navigator as Navigator & { vibrate: (ms: number) => void }).vibrate(10);
      }
      const result = await getJobsPage(page + 1, filters);
      setLoadingMore(false);
      if (result.ok && result.listings.length > 0) {
        setListings((prev) => {
          const merged = [...prev, ...(result.listings as ListingRow[])];
          const seen = new Set<string>();
          return merged.filter((l) => {
            const id = String(l.id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
        });
        setBidCountByListingId((prev) => ({ ...prev, ...result.bidCountByListingId }));
        setListerCardDataByListingId((prev) => ({
          ...prev,
          ...(result.listerCardDataByListingId ?? {}),
        }));
        setPage((p) => p + 1);
        setHasMore(result.listings.length >= INITIAL_PAGE_SIZE);
        if (!opts?.silent) {
          toast({ title: "Loaded more", description: `${result.listings.length} more jobs added.` });
        }
      } else {
        setHasMore(false);
      }
    },
    [filters, hasMore, loadingMore, page, toast]
  );

  // Infinite scroll: when sentinel is visible, load next page (silent)
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (e?.isIntersecting && hasMore && !loadingMore) {
          loadMore({ silent: true });
        }
      },
      { root: null, rootMargin: "200px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  useEffect(() => {
    const channel = supabase
      .channel("listings-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listings",
          filter: "status=eq.live"
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as ListingRow & { cancelled_early_at?: string | null };
            const cancelledEarly =
              row.cancelled_early_at != null && String(row.cancelled_early_at).trim() !== "";
            if (!cancelledEarly && parseUtcTimestamp(row.end_time) > Date.now()) {
              setListings((prev) => {
                if (prev.some((l) => String(l.id) === String(row.id))) return prev;
                return [row, ...prev];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as ListingRow & { cancelled_early_at?: string | null };
            const cancelledEarly =
              row.cancelled_early_at != null && String(row.cancelled_early_at).trim() !== "";
            const stillLive =
              String(row.status ?? "").toLowerCase() === "live" &&
              !cancelledEarly &&
              parseUtcTimestamp(row.end_time) > Date.now();
            setListings((prev) => {
              if (!stillLive) {
                return prev.filter((l) => String(l.id) !== String(row.id));
              }
              return prev.map((l) => (l.id === row.id ? row : l));
            });
          } else if (payload.eventType === "DELETE") {
            setListings((prev) => prev.filter((l) => l.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    const onRadius = (e: Event) => {
      const ce = e as CustomEvent<number>;
      if (typeof ce.detail === "number") {
        setMobileRadiusKm(clampRadiusKm(ce.detail));
      }
    };
    window.addEventListener(JOBS_RADIUS_CHANGED_EVENT, onRadius);
    return () => window.removeEventListener(JOBS_RADIUS_CHANGED_EVENT, onRadius);
  }, []);

  const nowMs = Date.now();
  const live = listings.filter(
    (l) => l.status === "live" && parseUtcTimestamp(l.end_time) > nowMs
  );

  const displayListings = useMemo(() => {
    if (!isMobile || centerLat == null || centerLon == null) return live;
    return live.filter((l) => {
      const row = l as ListingRow & { lat?: number; lon?: number };
      if (typeof row.lat !== "number" || typeof row.lon !== "number") return true;
      return haversineKm(centerLat, centerLon, row.lat, row.lon) <= mobileRadiusKm;
    });
  }, [live, isMobile, centerLat, centerLon, mobileRadiusKm]);

  useEffect(() => {
    setJobsSearchCount?.(displayListings.length);
  }, [displayListings.length, setJobsSearchCount]);

  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMarginTop, setScrollMarginTop] = useState(0);
  const useVirtualList =
    isMobile && displayListings.length > MOBILE_VIRTUALIZE_MIN;

  useEffect(() => {
    if (listRef.current && useVirtualList) {
      const top = listRef.current.getBoundingClientRect().top + window.scrollY;
      setScrollMarginTop(top);
    }
  }, [displayListings.length, useVirtualList]);

  const estimatedCardHeight = isMobile
    ? ESTIMATED_CARD_HEIGHT_MOBILE_COMPACT
    : ESTIMATED_CARD_HEIGHT;

  const rowVirtualizer = useWindowVirtualizer({
    count: useVirtualList ? displayListings.length : 0,
    estimateSize: () => estimatedCardHeight,
    getScrollElement: () => window,
    scrollMargin: scrollMarginTop,
    overscan: 5,
    gap: 12,
  });

  const virtualItems = useVirtualList ? rowVirtualizer.getVirtualItems() : [];

  // Preload first 3–4 thumbnails for LCP (run when initial list identity changes)
  const preloadKey = displayListings
    .slice(0, PRELOAD_IMAGE_COUNT)
    .map((l) => l.id)
    .join(",");
  useEffect(() => {
    const urls = displayListings
      .slice(0, PRELOAD_IMAGE_COUNT)
      .map((l) => getListingCoverUrl(l))
      .filter((u): u is string => Boolean(u));
    const links: HTMLLinkElement[] = [];
    urls.forEach((url) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      document.head.appendChild(link);
      links.push(link);
    });
    return () => links.forEach((link) => link.remove());
  }, [preloadKey, displayListings]);

  function renderCard(listing: ListingRow, index: number) {
    const row = listing as ListingRow & { lat?: number; lon?: number };
    const distanceKm =
      centerLat != null &&
      centerLon != null &&
      typeof row.lat === "number" &&
      typeof row.lon === "number"
        ? haversineKm(centerLat, centerLon, row.lat, row.lon)
        : undefined;
    const bidCount = bidCountByListingId[String(listing.id)] ?? 0;
    const isListerOwner = Boolean(currentUserId && (listing as { lister_id?: string }).lister_id === currentUserId);
    const listerCard = listerCardDataByListingId[String(listing.id)];
    return (
      <AnimatedListingCard
        key={listing.id}
        listing={listing}
        showPlaceBid
        isCleaner={isCleaner}
        isListerOwner={isListerOwner}
        showListerActions={showListerActionsResolved}
        distanceKm={distanceKm}
        bidCount={bidCount}
        priority={index < PRELOAD_IMAGE_COUNT}
        listerName={listerCard?.listerName ?? null}
        listerVerificationBadges={listerCard?.listerVerificationBadges ?? null}
        compactMobileMarketplace={false}
      />
    );
  }

  const infiniteScrollFooter = (
    <div className="flex flex-col items-center gap-2 py-6">
      {loadingMore && (
        <div className="flex flex-col items-center gap-2" aria-live="polite" aria-busy="true">
          <Loader2 className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
          <span className="text-sm text-muted-foreground dark:text-gray-400">Loading more jobs…</span>
        </div>
      )}
      {!hasMore && displayListings.length > 0 && !loadingMore && (
        <p className="text-sm text-muted-foreground dark:text-gray-400">No more jobs</p>
      )}
      {hasMore && !loadingMore && (
        <>
          <div
            ref={loadMoreSentinelRef}
            className="h-1 w-full min-h-[1px]"
            aria-hidden
          />
          <Button
            variant="outline"
            onClick={() => loadMore()}
            className="hidden min-h-12 sm:inline-flex focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Load more jobs"
          >
            Load more
          </Button>
        </>
      )}
    </div>
  );

  const listContent = displayListings.length === 0 ? (
    <p className="px-2 py-8 text-center text-base font-medium leading-relaxed text-muted-foreground md:text-sm">
      {live.length === 0 ? (
        <>No live jobs right now. Check back later or adjust your search filters.</>
      ) : (
        <>
          No jobs in this area yet — try increasing radius or broadening your suburb search.
        </>
      )}
    </p>
  ) : useVirtualList ? (
    <div ref={listRef} className="w-full">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const listing = displayListings[virtualRow.index];
          if (!listing) return null;
          return (
            <div
              key={listing.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderCard(listing, virtualRow.index)}
            </div>
          );
        })}
      </div>
      {infiniteScrollFooter}
    </div>
  ) : (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-6">
        {displayListings.map((listing, index) => renderCard(listing, index))}
      </div>
      {infiniteScrollFooter}
    </div>
  );

  const mobileRadiusStickyBar =
    showMobileRadiusStrip && centerLat != null && centerLon != null ? (
      <TooltipProvider delayDuration={200}>
        <div
          className="sticky top-0 z-40 -mx-4 mb-4 border-b border-border bg-background/95 px-4 pb-3 pt-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 dark:border-gray-800 dark:bg-gray-950/95 md:hidden"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <MapPin className="h-6 w-6 shrink-0 text-primary" strokeWidth={2} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight text-foreground dark:text-gray-100">
                    Jobs within {formatRadiusBannerLabel(mobileRadiusKm, distanceUnit)}
                  </p>
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    Drag to filter · Saved on this device
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="secondary" className="tabular-nums text-sm font-bold">
                  {formatRadiusBannerLabel(mobileRadiusKm, distanceUnit)}
                </Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="How radius filtering works"
                    >
                      <HelpCircle className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                    Only listings with map coordinates are filtered by distance. Others stay visible.
                    Radius is stored in your browser (default matches your profile travel setting when
                    available).
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <Slider
              min={5}
              max={MAX_TRAVEL_KM}
              step={5}
              value={[mobileRadiusKm]}
              onValueChange={(v) => {
                const next = clampRadiusKm(v[0] ?? 30);
                setMobileRadiusKm(next);
                setStoredRadiusKm(next);
              }}
              className="w-full py-1 [&_[role=slider]]:h-11 [&_[role=slider]]:w-11 [&_[role=slider]]:min-h-[44px] [&_[role=slider]]:min-w-[44px]"
              aria-label={`Search radius: ${mobileRadiusKm} kilometers`}
            />
            <p className="text-xs leading-snug text-muted-foreground dark:text-gray-500">
              {isCleaner
                ? "Open a listing to place a bid or save it to favourites from the job page."
                : "Adjust radius to see more or fewer jobs near you."}
            </p>
          </div>
        </div>
      </TooltipProvider>
    ) : null;

  return (
    <>
      {mobileRadiusStickyBar}
      {listContent}
    </>
  );
}

/** Alias for JobsList: infinite scroll job list. Use on /jobs and search results. */
export const JobListWithRefreshAndInfinite = JobsList;
