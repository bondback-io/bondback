"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  clampRadiusKm,
  setStoredRadiusKm,
  JOBS_RADIUS_SYNC_SESSION_KEY,
} from "@/lib/jobs-radius-local";
import {
  getStoredSearchPostcode,
  getStoredSearchSuburb,
  setStoredSearchPostcode,
  setStoredSearchSuburb,
} from "@/lib/mobile-job-search-storage";
import { useDistanceUnit } from "@/hooks/use-distance-unit";
import { formatRadiusBannerLabel } from "@/lib/distance-format";
import { MAX_TRAVEL_KM } from "@/lib/max-travel-km";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** JobsList listens for instant radius updates without full navigation. */
export const JOBS_RADIUS_CHANGED_EVENT = "bondback:jobs-radius-changed";

type SuburbRow = {
  suburb: string;
  postcode: string | number;
  state: string | null;
  lat?: number | null;
  lon?: number | null;
};

type JobsSearchCountContextValue = {
  setResultCount: (n: number) => void;
};

const JobsSearchCountContext =
  React.createContext<JobsSearchCountContextValue | null>(null);

export function useJobsSearchCountSetter() {
  return React.useContext(JobsSearchCountContext)?.setResultCount;
}

export type JobsPageMobileChromeProps = {
  children: React.ReactNode;
  initialResultCount: number;
  defaultRadiusKm: number;
  profileSuburb: string | null;
  initialSuburb: string;
  initialPostcode: string;
  initialRadiusKm: number;
  initialCenterLat: number | null;
  initialCenterLon: number | null;
  initialMinBidPrice?: string;
  initialMaxBidPrice?: string;
  initialBuyNowOnly?: boolean;
  initialSort?: string;
  initialMinPrice?: string;
  initialMaxPrice?: string;
  initialBedrooms?: string;
  initialBathrooms?: string;
  initialPropertyType?: string;
  initialServiceType?: string;
  initialUrgentOnly?: boolean;
};

/**
 * Wraps /jobs mobile: search bar + count context for JobsList.
 */
export function JobsPageMobileChrome({
  children,
  initialResultCount,
  initialMinBidPrice = "",
  initialMaxBidPrice = "",
  initialBuyNowOnly = false,
  initialSort = "",
  initialMinPrice = "",
  initialMaxPrice = "",
  initialBedrooms = "",
  initialBathrooms = "",
  initialPropertyType = "",
  initialServiceType = "",
  initialUrgentOnly = false,
  ...barProps
}: JobsPageMobileChromeProps) {
  const [count, setCount] = React.useState(initialResultCount);
  React.useEffect(() => {
    setCount(initialResultCount);
  }, [initialResultCount]);

  const value = React.useMemo(
    () => ({ setResultCount: setCount }),
    []
  );

  return (
    <JobsSearchCountContext.Provider value={value}>
      <div className="mx-auto w-full max-w-6xl px-3 pt-2 md:px-4 md:pt-4">
        <MobileJobSearchBar
          variant="jobs"
          resultCount={count}
          initialMinBidPrice={initialMinBidPrice}
          initialMaxBidPrice={initialMaxBidPrice}
          initialBuyNowOnly={initialBuyNowOnly}
          initialSort={initialSort}
          initialMinPrice={initialMinPrice}
          initialMaxPrice={initialMaxPrice}
          initialBedrooms={initialBedrooms}
          initialBathrooms={initialBathrooms}
          initialPropertyType={initialPropertyType}
          initialServiceType={initialServiceType}
          initialUrgentOnly={initialUrgentOnly}
          {...barProps}
        />
      </div>
      {children}
    </JobsSearchCountContext.Provider>
  );
}

const CLEANERS_URL_PARAMS = new Set([
  "suburb",
  "postcode",
  "radius_km",
  "center_lat",
  "center_lon",
]);

function buildSearchHref(
  path: "/find-jobs" | "/cleaners",
  base: URLSearchParams,
  patch: Record<string, string | undefined | null>
): string {
  const next = new URLSearchParams(base.toString());
  Object.entries(patch).forEach(([k, v]) => {
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
  });
  if (path === "/cleaners") {
    for (const key of [...next.keys()]) {
      if (!CLEANERS_URL_PARAMS.has(key)) next.delete(key);
    }
  }
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

export type MobileJobSearchBarProps = {
  variant: "jobs" | "dashboard" | "cleaners";
  defaultRadiusKm: number;
  profileSuburb?: string | null;
  /** jobs URL / SSR */
  initialSuburb?: string;
  initialPostcode?: string;
  initialRadiusKm?: number;
  initialCenterLat?: number | null;
  initialCenterLon?: number | null;
  initialMinBidPrice?: string;
  initialMaxBidPrice?: string;
  initialBuyNowOnly?: boolean;
  initialSort?: string;
  initialMinPrice?: string;
  initialMaxPrice?: string;
  initialBedrooms?: string;
  initialBathrooms?: string;
  initialPropertyType?: string;
  initialServiceType?: string;
  initialUrgentOnly?: boolean;
  resultCount?: number;
  className?: string;
  /** When false, bar is not sticky (e.g. nested in dashboard header). Default true. */
  sticky?: boolean;
};

function useMdUp() {
  const [mdUp, setMdUp] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setMdUp(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mdUp;
}

function dispatchRadius(km: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(JOBS_RADIUS_CHANGED_EVENT, { detail: km })
  );
}

export type CleanersPageMobileChromeProps = {
  children: React.ReactNode;
  initialResultCount: number;
  defaultRadiusKm: number;
  profileSuburb: string | null;
  initialSuburb: string;
  initialPostcode: string;
  initialRadiusKm: number;
  initialCenterLat: number | null;
  initialCenterLon: number | null;
};

export function CleanersPageMobileChrome({
  children,
  initialResultCount,
  ...barProps
}: CleanersPageMobileChromeProps) {
  const [count, setCount] = React.useState(initialResultCount);
  React.useEffect(() => {
    setCount(initialResultCount);
  }, [initialResultCount]);

  const value = React.useMemo(() => ({ setResultCount: setCount }), []);

  return (
    <JobsSearchCountContext.Provider value={value}>
      <div className="mx-auto w-full max-w-6xl px-2 pt-1 sm:px-3 md:px-4 md:pt-4">
        <MobileJobSearchBar variant="cleaners" resultCount={count} {...barProps} />
      </div>
      {children}
    </JobsSearchCountContext.Provider>
  );
}

export function MobileJobSearchBar({
  variant,
  defaultRadiusKm,
  profileSuburb = null,
  initialSuburb = "",
  initialPostcode = "",
  initialRadiusKm = 30,
  initialCenterLat = null,
  initialCenterLon = null,
  initialMinBidPrice = "",
  initialMaxBidPrice = "",
  initialBuyNowOnly = false,
  initialSort = "",
  initialMinPrice = "",
  initialMaxPrice = "",
  initialBedrooms = "",
  initialBathrooms = "",
  initialPropertyType = "",
  initialServiceType = "",
  initialUrgentOnly = false,
  resultCount = 0,
  className,
  sticky = true,
}: MobileJobSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const distanceUnit = useDistanceUnit();
  const mdUp = useMdUp();
  const suburbSuggestListId = React.useId();

  const [sheetOpen, setSheetOpen] = React.useState(false);
  /** After picking a suburb on /find-jobs, hide the inline list until the user edits again. */
  const [suburbSuggestionsDismissed, setSuburbSuggestionsDismissed] = React.useState(
    () => Boolean(initialSuburb?.trim())
  );
  const skipRadiusFromUrlOnceRef = React.useRef(false);
  const [radiusKm, setRadiusKm] = React.useState(() => {
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem(JOBS_RADIUS_SYNC_SESSION_KEY) === "1"
    ) {
      return clampRadiusKm(defaultRadiusKm);
    }
    return clampRadiusKm(initialRadiusKm || defaultRadiusKm);
  });
  const [suburb, setSuburb] = React.useState(initialSuburb);
  const [postcode, setPostcode] = React.useState(initialPostcode);
  const [centerLat, setCenterLat] = React.useState<number | null>(
    initialCenterLat
  );
  const [centerLon, setCenterLon] = React.useState<number | null>(
    initialCenterLon
  );
  const [query, setQuery] = React.useState(initialSuburb);
  const [results, setResults] = React.useState<SuburbRow[]>([]);
  const [pending, setPending] = React.useState(false);
  const [locating, setLocating] = React.useState(false);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const bidDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [minBidPrice, setMinBidPrice] = React.useState(
    () => initialMinBidPrice
  );
  const [maxBidPrice, setMaxBidPrice] = React.useState(
    () => initialMaxBidPrice
  );
  const [buyNowOnly, setBuyNowOnly] = React.useState(() => initialBuyNowOnly);

  const [sort, setSort] = React.useState(
    () => initialSort?.trim() || "ending-soon"
  );
  const [minReservePrice, setMinReservePrice] = React.useState(
    initialMinPrice ?? ""
  );
  const [maxReservePrice, setMaxReservePrice] = React.useState(
    initialMaxPrice ?? ""
  );
  const [bedrooms, setBedrooms] = React.useState(() => {
    const b = initialBedrooms?.trim();
    return b && b !== "" && b !== "any" ? b : "any";
  });
  const [bathrooms, setBathrooms] = React.useState(() => {
    const b = initialBathrooms?.trim();
    return b && b !== "" && b !== "any" ? b : "any";
  });
  const [propertyType, setPropertyType] = React.useState(() => {
    const p = initialPropertyType?.trim();
    return p && p !== "" && p !== "any" ? p : "any";
  });
  const [serviceType, setServiceType] = React.useState(() => {
    const s = initialServiceType?.trim();
    return s && s !== "" && s !== "any" ? s : "any";
  });
  const [urgentOnly, setUrgentOnly] = React.useState(() => initialUrgentOnly === true);

  const minBidRef = React.useRef(minBidPrice);
  const maxBidRef = React.useRef(maxBidPrice);
  minBidRef.current = minBidPrice;
  maxBidRef.current = maxBidPrice;

  const minReserveRef = React.useRef(minReservePrice);
  const maxReserveRef = React.useRef(maxReservePrice);
  minReserveRef.current = minReservePrice;
  maxReserveRef.current = maxReservePrice;

  const reserveDebounceRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  React.useEffect(() => {
    setMinBidPrice(searchParams.get("min_bid_price") ?? "");
    setMaxBidPrice(searchParams.get("max_bid_price") ?? "");
    setBuyNowOnly(searchParams.get("buy_now_only") === "1");
    setSort(searchParams.get("sort")?.trim() || "ending-soon");
    setMinReservePrice(searchParams.get("min_price") ?? "");
    setMaxReservePrice(searchParams.get("max_price") ?? "");
    const br = searchParams.get("bedrooms");
    setBedrooms(br && br !== "any" && br ? br : "any");
    const ba = searchParams.get("bathrooms");
    setBathrooms(ba && ba !== "any" && ba ? ba : "any");
    const pt = searchParams.get("property_type");
    setPropertyType(pt && pt !== "any" && pt ? pt : "any");
    const st = searchParams.get("service_type");
    setServiceType(st && st !== "any" && st ? st : "any");
    setUrgentOnly(searchParams.get("urgent_only") === "1");
  }, [searchParams]);

  React.useEffect(() => {
    const lsSub = getStoredSearchSuburb();
    const lsPc = getStoredSearchPostcode();
    if (!initialSuburb && lsSub) setSuburb(lsSub);
    if (!initialPostcode && lsPc) setPostcode(lsPc);
    if (!initialSuburb && lsSub) setQuery(lsSub);
  }, [initialSuburb, initialPostcode]);

  /** Sync geo from URL — do not set `query` here so typing isn't wiped when the URL updates. */
  React.useEffect(() => {
    setSuburb(initialSuburb);
    setPostcode(initialPostcode);
    setCenterLat(initialCenterLat);
    setCenterLon(initialCenterLon);
  }, [
    initialSuburb,
    initialPostcode,
    initialCenterLat,
    initialCenterLon,
  ]);

  const suburbLabel =
    suburb.trim() ||
    query.trim() ||
    profileSuburb?.trim() ||
    (centerLat != null && centerLon != null ? "Near me" : "Area");

  const navigateSearch = React.useCallback(
    (patch: Record<string, string | undefined | null>, replace = true) => {
      if (variant === "dashboard") {
        const sp = new URLSearchParams();
        Object.entries(patch).forEach(([k, v]) => {
          if (v != null && v !== "") sp.set(k, v);
        });
        const qs = sp.toString();
        router.push(qs ? `/find-jobs?${qs}` : "/find-jobs");
        return;
      }
      const path = variant === "cleaners" ? "/cleaners" : "/find-jobs";
      const href = buildSearchHref(
        path,
        new URLSearchParams(searchParams?.toString() ?? ""),
        patch
      );
      if (replace) router.replace(href);
      else router.push(href);
    },
    [router, searchParams, variant]
  );

  /** After profile max travel save, sync search radius (and /jobs URL when on jobs page). */
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(JOBS_RADIUS_SYNC_SESSION_KEY) !== "1") return;
    skipRadiusFromUrlOnceRef.current = true;
    sessionStorage.removeItem(JOBS_RADIUS_SYNC_SESSION_KEY);
    const next = clampRadiusKm(defaultRadiusKm);
    setRadiusKm(next);
    setStoredRadiusKm(next);
    dispatchRadius(next);
    if (variant === "jobs" || variant === "cleaners") {
      navigateSearch({ radius_km: String(next) }, true);
    }
  }, [defaultRadiusKm, navigateSearch, variant]);

  React.useEffect(() => {
    if (skipRadiusFromUrlOnceRef.current) {
      skipRadiusFromUrlOnceRef.current = false;
      return;
    }
    setRadiusKm(clampRadiusKm(initialRadiusKm || defaultRadiusKm));
  }, [initialRadiusKm, defaultRadiusKm]);

  const scheduleBidFilterNavigate = React.useCallback(() => {
    if (variant !== "jobs") return;
    if (bidDebounceRef.current) clearTimeout(bidDebounceRef.current);
    bidDebounceRef.current = setTimeout(() => {
      navigateSearch({
        min_bid_price: minBidRef.current.trim() || undefined,
        max_bid_price: maxBidRef.current.trim() || undefined,
      });
    }, 450);
  }, [navigateSearch, variant]);

  React.useEffect(() => {
    return () => {
      if (bidDebounceRef.current) clearTimeout(bidDebounceRef.current);
      if (reserveDebounceRef.current) clearTimeout(reserveDebounceRef.current);
    };
  }, []);

  const scheduleReserveFilterNavigate = React.useCallback(() => {
    if (variant !== "jobs") return;
    if (reserveDebounceRef.current) clearTimeout(reserveDebounceRef.current);
    reserveDebounceRef.current = setTimeout(() => {
      navigateSearch({
        min_price: minReserveRef.current.trim() || undefined,
        max_price: maxReserveRef.current.trim() || undefined,
      });
    }, 450);
  }, [navigateSearch, variant]);

  const debouncedNavigateSuburb = React.useCallback(
    (sub: string, pc: string, lat: string | undefined, lon: string | undefined) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        navigateSearch({
          suburb: sub.trim() || undefined,
          postcode: pc.trim() || undefined,
          center_lat: lat,
          center_lon: lon,
        });
      }, 320);
    },
    [navigateSearch]
  );

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const supabase = createBrowserSupabaseClient();
    setPending(true);
    const t = setTimeout(() => {
      supabase
        .from("suburbs")
        .select("suburb, postcode, state, lat, lon")
        .ilike("suburb", `%${query.trim()}%`)
        .order("suburb", { ascending: true })
        .limit(10)
        .then(({ data, error }) => {
          setPending(false);
          if (error) {
            setResults([]);
            return;
          }
          setResults((data ?? []) as SuburbRow[]);
        });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const selectSuburbRow = (row: SuburbRow) => {
    setSuburb(row.suburb);
    setPostcode(String(row.postcode ?? ""));
    setQuery(row.suburb);
    setStoredSearchSuburb(row.suburb);
    setStoredSearchPostcode(String(row.postcode ?? ""));
    if (typeof row.lat === "number" && typeof row.lon === "number") {
      setCenterLat(row.lat);
      setCenterLon(row.lon);
      navigateSearch({
        suburb: row.suburb,
        postcode: String(row.postcode ?? ""),
        center_lat: String(row.lat),
        center_lon: String(row.lon),
        radius_km: String(radiusKm),
      });
    } else {
      navigateSearch({
        suburb: row.suburb,
        postcode: String(row.postcode ?? ""),
        center_lat: undefined,
        center_lon: undefined,
        radius_km: String(radiusKm),
      });
    }
    if (variant === "jobs") {
      setSuburbSuggestionsDismissed(true);
    }
    setSheetOpen(false);
  };

  const handleMainInput = (value: string) => {
    if (variant === "jobs") {
      setSuburbSuggestionsDismissed(false);
    }
    const trimmed = value.trim();
    setQuery(value);

    if (variant === "cleaners") {
      if (trimmed === "") {
        setSuburb("");
        setPostcode("");
        setCenterLat(null);
        setCenterLon(null);
        setStoredSearchSuburb("");
        setStoredSearchPostcode("");
        debouncedNavigateSuburb("", "", undefined, undefined);
        return;
      }
      if (suburb && trimmed !== suburb.trim()) {
        setSuburb("");
        setPostcode("");
        setCenterLat(null);
        setCenterLon(null);
      }
      return;
    }

    if (trimmed === "") {
      setSuburb("");
      setPostcode("");
      setCenterLat(null);
      setCenterLon(null);
      setStoredSearchSuburb("");
      setStoredSearchPostcode("");
      debouncedNavigateSuburb("", "", undefined, undefined);
    } else {
      debouncedNavigateSuburb(
        value,
        postcode,
        centerLat != null ? String(centerLat) : undefined,
        centerLon != null ? String(centerLon) : undefined
      );
    }
  };

  const applyRadius = (km: number, syncUrl: boolean) => {
    const next = clampRadiusKm(km);
    setRadiusKm(next);
    setStoredRadiusKm(next);
    dispatchRadius(next);
    if (syncUrl) {
      setStoredSearchSuburb(suburb);
      setStoredSearchPostcode(postcode);
      navigateSearch({
        radius_km: String(next),
        suburb: suburb.trim() || undefined,
        postcode: postcode.trim() || undefined,
        center_lat:
          centerLat != null ? String(centerLat) : undefined,
        center_lon:
          centerLon != null ? String(centerLon) : undefined,
      });
    }
  };

  const handleUseLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      toast({
        variant: "destructive",
        title: "Location not supported",
        description: "Enter your suburb manually.",
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const supabase = createBrowserSupabaseClient();
          const { data, error } = await supabase
            .from("suburbs")
            .select("suburb, postcode, state, lat, lon")
            .limit(2000);
          if (error || !data?.length) {
            toast({
              title: "Could not match location",
              description: "Type your suburb instead.",
            });
            return;
          }
          const rows = data as SuburbRow[];
          const toRad = (deg: number) => (deg * Math.PI) / 180;
          const R = 6371;
          let best: SuburbRow | null = null;
          let bestDist = Infinity;
          for (const row of rows) {
            if (row.lat == null || row.lon == null) continue;
            const dLat = toRad(row.lat - latitude);
            const dLon = toRad(row.lon - longitude);
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(latitude)) *
                Math.cos(toRad(row.lat)) *
                Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const d = R * c;
            if (d < bestDist) {
              bestDist = d;
              best = row;
            }
          }
          if (!best) {
            toast({
              title: "Could not match suburb",
              description: "Enter your suburb manually.",
            });
            return;
          }
          selectSuburbRow(best);
          toast({
            title: "Location set",
            description: `${best.suburb} ${best.postcode}`,
          });
        } catch {
          toast({
            variant: "destructive",
            title: "Location error",
            description: "Try entering suburb manually.",
          });
        } finally {
          setLocating(false);
        }
      },
      () => {
        toast({
          variant: "destructive",
          title: "Location unavailable",
          description: "Allow location or enter suburb manually.",
        });
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 12000 }
    );
  };

  const hasExtraFilters =
    variant === "jobs" &&
    (minBidPrice.trim() !== "" ||
      maxBidPrice.trim() !== "" ||
      buyNowOnly ||
      (sort && sort !== "ending-soon") ||
      minReservePrice.trim() !== "" ||
      maxReservePrice.trim() !== "" ||
      bedrooms !== "any" ||
      bathrooms !== "any" ||
      propertyType !== "any");
  const pillLabel = `${formatRadiusBannerLabel(radiusKm, distanceUnit)} (${suburbLabel})`;

  /**
   * Cleaners: hide once the typed query matches the committed suburb (select flow clears suburb until pick).
   * Jobs (/find-jobs): inline list was cleaners-only — use dismiss flag so URL-driven suburb sync does not hide it mid-type.
   */
  const showSuburbSuggestions =
    query.trim().length >= 2 &&
    (variant === "cleaners"
      ? suburb.trim() === "" ||
        query.trim().toLowerCase() !== suburb.trim().toLowerCase()
      : variant === "jobs"
        ? !suburbSuggestionsDismissed
        : false);

  return (
    <div
      className={cn(
        sticky
          ? "sticky top-0 z-20 border-b border-border/80 bg-background/95 pb-3 pt-2 shadow-sm backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 md:pb-4"
          : "relative border-0 bg-transparent pb-2 pt-0 shadow-none",
        sticky && variant === "cleaners" && "pb-2 pt-1.5 md:pb-4 md:pt-2",
        className
      )}
    >
      <div className="flex items-center gap-2 md:gap-3">
        <div className="relative z-30 min-h-[44px] min-w-0 flex-1 md:min-h-[44px]">
          <Input
            type="search"
            enterKeyHint="search"
            placeholder="Type a suburb — pick from suggestions"
            value={query}
            onChange={(e) => handleMainInput(e.target.value)}
            onKeyDown={(e) => {
              if (variant !== "cleaners" && variant !== "jobs") return;
              if (e.key !== "Enter") return;
              if (!showSuburbSuggestions) return;
              const first = results[0];
              if (pending || !first) return;
              e.preventDefault();
              selectSuburbRow(first);
            }}
            className={cn(
              "h-11 min-h-[44px] min-w-0 rounded-2xl border border-border bg-card pl-4 pr-4 text-base text-foreground shadow-sm",
              "truncate",
              "placeholder:text-muted-foreground",
              "focus-visible:ring-2 focus-visible:ring-primary/30",
              "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
              "md:h-11 md:max-w-full"
            )}
            aria-label={
              variant === "cleaners"
                ? "Search cleaners by suburb"
                : "Search jobs by suburb"
            }
            aria-autocomplete={
              variant === "cleaners" || variant === "jobs" ? "list" : undefined
            }
            aria-expanded={
              variant === "cleaners" || variant === "jobs"
                ? showSuburbSuggestions
                : undefined
            }
            aria-controls={
              (variant === "cleaners" || variant === "jobs") && showSuburbSuggestions
                ? suburbSuggestListId
                : undefined
            }
          />
          {showSuburbSuggestions && (
            <div
              className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg dark:border-gray-700 dark:bg-gray-900"
              id={suburbSuggestListId}
            >
              {pending && (
                <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                  Searching suburbs…
                </div>
              )}
              {!pending && results.length === 0 && (
                <p className="px-3 py-2.5 text-sm text-muted-foreground dark:text-gray-400">
                  No suburbs match — check spelling or try nearby
                </p>
              )}
              {!pending && results.length > 0 && (
                <ul className="max-h-60 overflow-y-auto py-1" role="listbox" aria-label="Matching suburbs">
                  {results.map((row) => (
                    <li key={`main-${row.suburb}-${row.postcode}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        className="flex w-full min-h-[44px] items-center px-3 py-2.5 text-left text-base hover:bg-muted dark:hover:bg-gray-800"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSuburbRow(row)}
                      >
                        <span className="font-medium">{row.suburb}</span>
                        <span className="ml-2 text-muted-foreground dark:text-gray-400">
                          {row.postcode}
                          {row.state ? ` ${row.state}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              title={pillLabel}
              className={cn(
                "inline-flex h-11 min-h-[44px] min-w-0 max-w-[min(42vw,11rem)] shrink items-center justify-start gap-1 overflow-hidden rounded-2xl border border-primary/40 bg-primary/10 px-2.5 text-left text-sm font-semibold text-primary sm:max-w-[min(280px,34vw)] md:max-w-[min(280px,32vw)] dark:border-primary/50 dark:bg-primary/15 dark:text-primary",
                hasExtraFilters && "ring-2 ring-primary/30"
              )}
              aria-label={
                variant === "cleaners"
                  ? "Open search area and radius"
                  : "Open search area, radius, and filters"
              }
            >
              <span className="min-w-0 flex-1 truncate">{pillLabel}</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side={mdUp ? "right" : "bottom"}
            title={variant === "cleaners" ? "Search area and radius" : "Search and filters"}
            className={cn(
              "border-border bg-card p-0 dark:border-gray-800 dark:bg-gray-950",
              mdUp
                ? "h-full !max-w-md w-full border-l"
                : "max-h-[88vh] rounded-t-2xl border-t"
            )}
          >
            <div className="border-b border-border px-4 pb-3 pt-4 text-left dark:border-gray-800">
              <SheetTitle className="text-lg font-semibold text-foreground dark:text-gray-100">
                {variant === "cleaners" ? "Search area & radius" : "Search & filters"}
              </SheetTitle>
              <p className="mt-1 text-base text-muted-foreground dark:text-gray-400">
                {variant === "cleaners" ? (
                  <>
                    Cleaners within{" "}
                    <span className="font-semibold text-foreground dark:text-gray-200">
                      {formatRadiusBannerLabel(radiusKm, distanceUnit)}
                    </span>
                  </>
                ) : (
                  <>
                    Jobs within{" "}
                    <span className="font-semibold text-foreground dark:text-gray-200">
                      {formatRadiusBannerLabel(radiusKm, distanceUnit)}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="space-y-6 overflow-y-auto px-4 py-5 pb-10">
              <div className="space-y-3">
                <Slider
                  min={5}
                  max={MAX_TRAVEL_KM}
                  step={5}
                  value={[radiusKm]}
                  onValueChange={(v) => {
                    const next = clampRadiusKm(v[0] ?? 30);
                    setRadiusKm(next);
                    setStoredRadiusKm(next);
                    dispatchRadius(next);
                    if (navigateDebounceRef.current)
                      clearTimeout(navigateDebounceRef.current);
                    navigateDebounceRef.current = setTimeout(() => {
                      navigateSearch({
                        radius_km: String(next),
                        suburb: suburb.trim() || undefined,
                        postcode: postcode.trim() || undefined,
                        center_lat:
                          centerLat != null ? String(centerLat) : undefined,
                        center_lon:
                          centerLon != null ? String(centerLon) : undefined,
                      });
                    }, 180);
                  }}
                  className="w-full py-2 [&_[role=slider]]:h-12 [&_[role=slider]]:w-12 [&_[role=slider]]:min-h-[48px] [&_[role=slider]]:min-w-[48px]"
                  aria-label={`Radius ${radiusKm} kilometers`}
                />
                <p className="text-center text-base font-medium text-foreground dark:text-gray-200">
                  {formatRadiusBannerLabel(radiusKm, distanceUnit)} radius
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground dark:text-gray-200">
                  Suburb
                </label>
                <Input
                  value={query}
                  onChange={(e) => handleMainInput(e.target.value)}
                  placeholder="Type a suburb"
                  className="h-12 min-h-[48px] text-base"
                />
                {pending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Searching…
                  </div>
                )}
                {query.trim().length >= 2 && results.length > 0 && (
                  <ul
                    className="max-h-48 overflow-y-auto rounded-xl border border-border bg-background dark:border-gray-700 dark:bg-gray-900"
                    role="listbox"
                  >
                    {results.map((row) => (
                      <li key={`${row.suburb}-${row.postcode}`}>
                        <button
                          type="button"
                          className="flex w-full min-h-[48px] items-center px-4 py-3 text-left text-base hover:bg-muted dark:hover:bg-gray-800"
                          onClick={() => selectSuburbRow(row)}
                        >
                          <span className="font-medium">{row.suburb}</span>
                          <span className="ml-2 text-muted-foreground">
                            {row.postcode}
                            {row.state ? ` ${row.state}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Button
                type="button"
                variant="secondary"
                className="h-12 min-h-[48px] w-full text-base font-semibold"
                onClick={handleUseLocation}
                disabled={locating}
              >
                {locating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Finding location…
                  </>
                ) : (
                  "Use my current location"
                )}
              </Button>

              {variant === "jobs" && (
              <>
              <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4 dark:border-gray-800 dark:bg-gray-900/40">
                <div>
                  <p className="text-sm font-semibold text-foreground dark:text-gray-100">
                    Sort &amp; property
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground dark:text-gray-500">
                    Reserve range uses the listing&apos;s reserve price (not the current bid).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobs-sort" className="text-xs text-muted-foreground">
                    Sort by
                  </Label>
                  <Select
                    value={sort}
                    onValueChange={(v) => {
                      setSort(v);
                      navigateSearch({
                        sort: v === "ending-soon" ? undefined : v,
                      });
                    }}
                  >
                    <SelectTrigger
                      id="jobs-sort"
                      className="h-11 rounded-xl border-border bg-background text-base dark:border-gray-600 dark:bg-gray-900"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ending-soon">Ending soon</SelectItem>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="price-asc">Reserve low to high</SelectItem>
                      <SelectItem value="price-desc">Reserve high to low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="jobs-min-reserve" className="text-xs text-muted-foreground">
                      Min reserve ($)
                    </Label>
                    <Input
                      id="jobs-min-reserve"
                      inputMode="numeric"
                      placeholder="0"
                      value={minReservePrice}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        minReserveRef.current = raw;
                        setMinReservePrice(raw);
                        scheduleReserveFilterNavigate();
                      }}
                      className="h-11 min-h-[44px] text-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="jobs-max-reserve" className="text-xs text-muted-foreground">
                      Max reserve ($)
                    </Label>
                    <Input
                      id="jobs-max-reserve"
                      inputMode="numeric"
                      placeholder="Any"
                      value={maxReservePrice}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        maxReserveRef.current = raw;
                        setMaxReservePrice(raw);
                        scheduleReserveFilterNavigate();
                      }}
                      className="h-11 min-h-[44px] text-base"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Bedrooms</Label>
                    <Select
                      value={bedrooms}
                      onValueChange={(v) => {
                        setBedrooms(v);
                        navigateSearch({
                          bedrooms: v === "any" ? undefined : v,
                        });
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-border bg-background dark:border-gray-600 dark:bg-gray-900">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="5">5+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Bathrooms</Label>
                    <Select
                      value={bathrooms}
                      onValueChange={(v) => {
                        setBathrooms(v);
                        navigateSearch({
                          bathrooms: v === "any" ? undefined : v,
                        });
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-border bg-background dark:border-gray-600 dark:bg-gray-900">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Property type</Label>
                  <Select
                    value={propertyType}
                    onValueChange={(v) => {
                      setPropertyType(v);
                      navigateSearch({
                        property_type: v === "any" ? undefined : v,
                      });
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border bg-background dark:border-gray-600 dark:bg-gray-900">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="apartment">Apartment</SelectItem>
                      <SelectItem value="house">House</SelectItem>
                      <SelectItem value="townhouse">Townhouse</SelectItem>
                      <SelectItem value="studio">Studio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Service type</Label>
                  <Select
                    value={serviceType}
                    onValueChange={(v) => {
                      setServiceType(v);
                      navigateSearch({
                        service_type: v === "any" ? undefined : v,
                      });
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border bg-background dark:border-gray-600 dark:bg-gray-900">
                      <SelectValue placeholder="Any service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any service</SelectItem>
                      <SelectItem value="bond_cleaning">Bond cleaning</SelectItem>
                      <SelectItem value="recurring_house_cleaning">Recurring house cleaning</SelectItem>
                      <SelectItem value="airbnb_turnover">Airbnb / short-stay turnover</SelectItem>
                      <SelectItem value="deep_clean">Deep / spring / move-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 dark:border-gray-800">
                  <div className="min-w-0 space-y-0.5 pr-2">
                    <Label
                      htmlFor="jobs-urgent-only"
                      className="text-sm font-medium text-foreground dark:text-gray-100"
                    >
                      Urgent jobs only
                    </Label>
                    <p className="text-xs text-muted-foreground dark:text-gray-500">
                      Listings the lister marked as urgent.
                    </p>
                  </div>
                  <Switch
                    id="jobs-urgent-only"
                    checked={urgentOnly}
                    onCheckedChange={(checked) => {
                      setUrgentOnly(checked);
                      navigateSearch({
                        urgent_only: checked ? "1" : undefined,
                      });
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 dark:border-gray-800 dark:bg-gray-900/40">
                <div>
                  <p className="text-sm font-semibold text-foreground dark:text-gray-100">
                    Latest bid (AUD)
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground dark:text-gray-500">
                    Filter by current lowest bid on each listing.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="jobs-min-bid" className="text-xs text-muted-foreground">
                      Min
                    </Label>
                    <Input
                      id="jobs-min-bid"
                      inputMode="numeric"
                      placeholder="0"
                      value={minBidPrice}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        minBidRef.current = raw;
                        setMinBidPrice(raw);
                        scheduleBidFilterNavigate();
                      }}
                      className="h-11 min-h-[44px] text-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="jobs-max-bid" className="text-xs text-muted-foreground">
                      Max
                    </Label>
                    <Input
                      id="jobs-max-bid"
                      inputMode="numeric"
                      placeholder="Any"
                      value={maxBidPrice}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        maxBidRef.current = raw;
                        setMaxBidPrice(raw);
                        scheduleBidFilterNavigate();
                      }}
                      className="h-11 min-h-[44px] text-base"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 dark:border-gray-800">
                <div className="min-w-0 space-y-0.5 pr-2">
                  <Label
                    htmlFor="jobs-buy-now-only"
                    className="text-sm font-medium text-foreground dark:text-gray-100"
                  >
                    Buy It Now only
                  </Label>
                  <p className="text-xs text-muted-foreground dark:text-gray-500">
                    Show listings that include a buy-now price.
                  </p>
                </div>
                <Switch
                  id="jobs-buy-now-only"
                  checked={buyNowOnly}
                  onCheckedChange={(checked) => {
                    setBuyNowOnly(checked);
                    navigateSearch({
                      buy_now_only: checked ? "1" : undefined,
                    });
                  }}
                />
              </div>
              </>
              )}

              <Button
                type="button"
                className="h-12 min-h-[48px] w-full text-base font-semibold"
                onClick={() => {
                  applyRadius(radiusKm, true);
                  setSheetOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {variant === "jobs" && mdUp && (
        <div
          className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/35 px-2 py-2 dark:border-gray-700/80 dark:bg-gray-900/50"
          role="group"
          aria-label="Quick filters"
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-[1_1_auto]">
            <span className="sr-only">Sort by</span>
            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v);
                navigateSearch({
                  sort: v === "ending-soon" ? undefined : v,
                });
              }}
            >
              <SelectTrigger
                className="h-9 w-[min(100%,11rem)] min-w-[9rem] rounded-full border-border/90 bg-background text-xs font-medium shadow-sm dark:border-gray-600 dark:bg-gray-950"
                aria-label="Sort by"
              >
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ending-soon">Ending soon</SelectItem>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="price-asc">Reserve low → high</SelectItem>
                <SelectItem value="price-desc">Reserve high → low</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={propertyType}
              onValueChange={(v) => {
                setPropertyType(v);
                navigateSearch({
                  property_type: v === "any" ? undefined : v,
                });
              }}
            >
              <SelectTrigger
                className="h-9 w-[min(100%,10rem)] min-w-[8rem] rounded-full border-border/90 bg-background text-xs font-medium shadow-sm dark:border-gray-600 dark:bg-gray-950"
                aria-label="Property type"
              >
                <SelectValue placeholder="Property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any property</SelectItem>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="townhouse">Townhouse</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={serviceType}
              onValueChange={(v) => {
                setServiceType(v);
                navigateSearch({
                  service_type: v === "any" ? undefined : v,
                });
              }}
            >
              <SelectTrigger
                className="h-9 w-[min(100%,11rem)] min-w-[8rem] rounded-full border-border/90 bg-background text-xs font-medium shadow-sm dark:border-gray-600 dark:bg-gray-950"
                aria-label="Service type"
              >
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any service</SelectItem>
                <SelectItem value="bond_cleaning">Bond clean</SelectItem>
                <SelectItem value="recurring_house_cleaning">Recurring</SelectItem>
                <SelectItem value="airbnb_turnover">Airbnb</SelectItem>
                <SelectItem value="deep_clean">Deep clean</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant={urgentOnly ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-9 shrink-0 rounded-full px-3 text-xs font-semibold",
                urgentOnly &&
                  "border-red-600 bg-red-600 text-white hover:bg-red-700 dark:border-red-500 dark:bg-red-600"
              )}
              aria-pressed={urgentOnly}
              onClick={() => {
                const next = !urgentOnly;
                setUrgentOnly(next);
                navigateSearch({
                  urgent_only: next ? "1" : undefined,
                });
              }}
            >
              Urgent
            </Button>

            <Select
              value={bedrooms}
              onValueChange={(v) => {
                setBedrooms(v);
                navigateSearch({
                  bedrooms: v === "any" ? undefined : v,
                });
              }}
            >
              <SelectTrigger
                className="h-9 w-[min(100%,7.5rem)] min-w-[6.5rem] rounded-full border-border/90 bg-background text-xs font-medium shadow-sm dark:border-gray-600 dark:bg-gray-950"
                aria-label="Bedrooms"
              >
                <SelectValue placeholder="Beds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any beds</SelectItem>
                <SelectItem value="1">1 bed</SelectItem>
                <SelectItem value="2">2 beds</SelectItem>
                <SelectItem value="3">3 beds</SelectItem>
                <SelectItem value="4">4 beds</SelectItem>
                <SelectItem value="5">5+ beds</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={bathrooms}
              onValueChange={(v) => {
                setBathrooms(v);
                navigateSearch({
                  bathrooms: v === "any" ? undefined : v,
                });
              }}
            >
              <SelectTrigger
                className="h-9 w-[min(100%,7.5rem)] min-w-[6.5rem] rounded-full border-border/90 bg-background text-xs font-medium shadow-sm dark:border-gray-600 dark:bg-gray-950"
                aria-label="Bathrooms"
              >
                <SelectValue placeholder="Baths" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any baths</SelectItem>
                <SelectItem value="1">1 bath</SelectItem>
                <SelectItem value="2">2 baths</SelectItem>
                <SelectItem value="3">3 baths</SelectItem>
                <SelectItem value="4">4+ baths</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-full border-dashed px-3 text-xs font-semibold"
            onClick={() => setSheetOpen(true)}
          >
            Area, price &amp; more
          </Button>
        </div>
      )}

      {(variant === "jobs" || variant === "cleaners") && (
        <p
          className={cn(
            "mt-2 px-0.5 font-medium leading-snug text-foreground dark:text-gray-200 md:text-sm",
            variant === "cleaners"
              ? "mt-1.5 text-xs text-muted-foreground dark:text-gray-400 md:mt-2 md:text-sm md:text-foreground md:dark:text-gray-200"
              : "text-sm"
          )}
          aria-live="polite"
        >
          {resultCount === 0 ? (
            <span className="text-muted-foreground dark:text-gray-400">
              {variant === "cleaners"
                ? "No cleaners in this area yet — try increasing radius"
                : "No jobs in this area yet — try increasing radius"}
            </span>
          ) : (
            <>
              {resultCount}{" "}
              {variant === "cleaners"
                ? `cleaner${resultCount === 1 ? "" : "s"}`
                : `job${resultCount === 1 ? "" : "s"}`}{" "}
              within {radiusKm} km of {suburbLabel}
            </>
          )}
        </p>
      )}
    </div>
  );
}
