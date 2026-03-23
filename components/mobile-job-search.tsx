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
          {...barProps}
        />
      </div>
      {children}
    </JobsSearchCountContext.Provider>
  );
}

export type MobileJobSearchBarProps = {
  variant: "jobs" | "dashboard";
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

function buildJobsHref(
  base: URLSearchParams,
  patch: Record<string, string | undefined | null>
): string {
  const next = new URLSearchParams(base.toString());
  Object.entries(patch).forEach(([k, v]) => {
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
  });
  const qs = next.toString();
  return qs ? `/jobs?${qs}` : "/jobs";
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
  resultCount = 0,
  className,
  sticky = true,
}: MobileJobSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const distanceUnit = useDistanceUnit();
  const mdUp = useMdUp();

  const [sheetOpen, setSheetOpen] = React.useState(false);
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
  }, [searchParams]);

  React.useEffect(() => {
    const lsSub = getStoredSearchSuburb();
    const lsPc = getStoredSearchPostcode();
    if (!initialSuburb && lsSub) setSuburb(lsSub);
    if (!initialPostcode && lsPc) setPostcode(lsPc);
    if (!initialSuburb && lsSub) setQuery(lsSub);
  }, [initialSuburb, initialPostcode]);

  React.useEffect(() => {
    setSuburb(initialSuburb);
    setPostcode(initialPostcode);
    setQuery(initialSuburb);
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
    profileSuburb?.trim() ||
    (centerLat != null && centerLon != null ? "Near me" : "Area");

  const navigateJobs = React.useCallback(
    (patch: Record<string, string | undefined | null>, replace = true) => {
      if (variant === "dashboard") {
        const sp = new URLSearchParams();
        Object.entries(patch).forEach(([k, v]) => {
          if (v != null && v !== "") sp.set(k, v);
        });
        const qs = sp.toString();
        router.push(qs ? `/jobs?${qs}` : "/jobs");
        return;
      }
      const href = buildJobsHref(
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
    if (variant === "jobs") {
      navigateJobs({ radius_km: String(next) }, true);
    }
  }, [defaultRadiusKm, navigateJobs, variant]);

  React.useEffect(() => {
    if (skipRadiusFromUrlOnceRef.current) {
      skipRadiusFromUrlOnceRef.current = false;
      return;
    }
    setRadiusKm(clampRadiusKm(initialRadiusKm || defaultRadiusKm));
  }, [initialRadiusKm, defaultRadiusKm]);

  const scheduleBidFilterNavigate = React.useCallback(() => {
    if (bidDebounceRef.current) clearTimeout(bidDebounceRef.current);
    bidDebounceRef.current = setTimeout(() => {
      navigateJobs({
        min_bid_price: minBidRef.current.trim() || undefined,
        max_bid_price: maxBidRef.current.trim() || undefined,
      });
    }, 450);
  }, [navigateJobs]);

  React.useEffect(() => {
    return () => {
      if (bidDebounceRef.current) clearTimeout(bidDebounceRef.current);
      if (reserveDebounceRef.current) clearTimeout(reserveDebounceRef.current);
    };
  }, []);

  const scheduleReserveFilterNavigate = React.useCallback(() => {
    if (reserveDebounceRef.current) clearTimeout(reserveDebounceRef.current);
    reserveDebounceRef.current = setTimeout(() => {
      navigateJobs({
        min_price: minReserveRef.current.trim() || undefined,
        max_price: maxReserveRef.current.trim() || undefined,
      });
    }, 450);
  }, [navigateJobs]);

  const debouncedNavigateSuburb = React.useCallback(
    (sub: string, pc: string, lat: string | undefined, lon: string | undefined) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        navigateJobs({
          suburb: sub.trim() || undefined,
          postcode: pc.trim() || undefined,
          center_lat: lat,
          center_lon: lon,
        });
      }, 320);
    },
    [navigateJobs]
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
      navigateJobs({
        suburb: row.suburb,
        postcode: String(row.postcode ?? ""),
        center_lat: String(row.lat),
        center_lon: String(row.lon),
        radius_km: String(radiusKm),
      });
    } else {
      navigateJobs({
        suburb: row.suburb,
        postcode: String(row.postcode ?? ""),
        center_lat: undefined,
        center_lon: undefined,
        radius_km: String(radiusKm),
      });
    }
    setSheetOpen(false);
  };

  const handleMainInput = (value: string) => {
    setQuery(value);
    setSuburb(value);
    if (value.trim() === "") {
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
      navigateJobs({
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
    minBidPrice.trim() !== "" ||
    maxBidPrice.trim() !== "" ||
    buyNowOnly ||
    (sort && sort !== "ending-soon") ||
    minReservePrice.trim() !== "" ||
    maxReservePrice.trim() !== "" ||
    bedrooms !== "any" ||
    bathrooms !== "any" ||
    propertyType !== "any";
  const pillLabel = `${formatRadiusBannerLabel(radiusKm, distanceUnit)} (${suburbLabel})`;

  return (
    <div
      className={cn(
        sticky
          ? "sticky top-0 z-[35] border-b border-border/80 bg-background/95 pb-3 pt-2 shadow-sm backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 md:pb-4"
          : "relative border-0 bg-transparent pb-2 pt-0 shadow-none",
        className
      )}
    >
      <div className="flex items-center gap-2 md:gap-3">
        <div className="relative min-h-[44px] min-w-0 flex-1 md:min-h-[44px]">
          <Input
            type="search"
            enterKeyHint="search"
            placeholder="Search jobs near me…"
            value={query}
            onChange={(e) => handleMainInput(e.target.value)}
            className={cn(
              "h-11 min-h-[44px] rounded-2xl border border-border bg-card pl-4 pr-4 text-base text-foreground shadow-sm",
              "placeholder:text-muted-foreground",
              "focus-visible:ring-2 focus-visible:ring-primary/30",
              "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
              "md:h-11 md:max-w-full"
            )}
            aria-label="Search jobs by suburb"
          />
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-primary",
                "max-w-[38vw] truncate sm:max-w-[min(280px,32vw)] dark:border-primary/50 dark:bg-primary/15 dark:text-primary",
                hasExtraFilters && "ring-2 ring-primary/30"
              )}
              aria-label="Open search area, radius, and filters"
            >
              {pillLabel}
            </button>
          </SheetTrigger>
          <SheetContent
            side={mdUp ? "right" : "bottom"}
            title="Search and filters"
            className={cn(
              "border-border bg-card p-0 dark:border-gray-800 dark:bg-gray-950",
              mdUp
                ? "h-full !max-w-md w-full border-l"
                : "max-h-[88vh] rounded-t-2xl border-t"
            )}
          >
            <div className="border-b border-border px-4 pb-3 pt-4 text-left dark:border-gray-800">
              <SheetTitle className="text-lg font-semibold text-foreground dark:text-gray-100">
                Search &amp; filters
              </SheetTitle>
              <p className="mt-1 text-base text-muted-foreground dark:text-gray-400">
                Jobs within{" "}
                <span className="font-semibold text-foreground dark:text-gray-200">
                  {formatRadiusBannerLabel(radiusKm, distanceUnit)}
                </span>
              </p>
            </div>
            <div className="space-y-6 overflow-y-auto px-4 py-5 pb-10">
              <div className="space-y-3">
                <Slider
                  min={5}
                  max={100}
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
                      navigateJobs({
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
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSuburb(e.target.value);
                    if (e.target.value.trim().length < 2) setResults([]);
                  }}
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
                      navigateJobs({
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
                        navigateJobs({
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
                        navigateJobs({
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
                      navigateJobs({
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
                    navigateJobs({
                      buy_now_only: checked ? "1" : undefined,
                    });
                  }}
                />
              </div>

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

      {variant === "jobs" && (
        <p
          className="mt-2 px-0.5 text-sm font-medium leading-snug text-foreground dark:text-gray-200 md:text-sm"
          aria-live="polite"
        >
          {resultCount === 0 ? (
            <span className="text-muted-foreground dark:text-gray-400">
              No jobs in this area yet — try increasing radius
            </span>
          ) : (
            <>
              {resultCount} job{resultCount === 1 ? "" : "s"} within{" "}
              {radiusKm} km of {suburbLabel}
            </>
          )}
        </p>
      )}
    </div>
  );
}
