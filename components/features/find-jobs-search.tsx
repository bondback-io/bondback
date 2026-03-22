"use client";

import * as React from "react";
import { useState, useEffect, useTransition, useId } from "react";
import {
  Search,
  Loader2,
  MapPin,
  Navigation,
  SlidersHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const RADIUS_PRESETS = [5, 10, 20, 50, 100] as const;

type SuburbRow = {
  suburb: string;
  postcode: string | number;
  state: string | null;
  lat?: number | null;
  lon?: number | null;
};

export type FindJobsSearchInitial = {
  suburb?: string;
  postcode?: string;
  radius_km?: string;
  center_lat?: string;
  center_lon?: string;
  sort?: string;
  min_price?: string;
  max_price?: string;
  bedrooms?: string;
  bathrooms?: string;
  property_type?: string;
};

export type FindJobsSearchProps = {
  className?: string;
  /** Home/marketing: compact card with no advanced sheet. Jobs page: full filters in sheet. */
  variant?: "home" | "jobs";
  /** Server-provided query defaults (jobs page). */
  initial?: FindJobsSearchInitial;
  /** Default radius when none in URL (e.g. profile max travel). */
  defaultRadiusKm?: number;
  /**
   * When set, submit is handled via client navigation (e.g. mobile nav drawer).
   * Omits empty/`any` params for cleaner URLs.
   */
  onNavigate?: (href: string) => void;
};

function appendFormToSearchParams(fd: FormData, params: URLSearchParams) {
  fd.forEach((value, key) => {
    if (typeof value !== "string") return;
    const t = value.trim();
    if (!t) return;
    if (
      (key === "bedrooms" || key === "bathrooms" || key === "property_type") &&
      t === "any"
    ) {
      return;
    }
    params.set(key, t);
  });
}

export function FindJobsSearch({
  className,
  variant = "home",
  initial,
  defaultRadiusKm = 20,
  onNavigate,
}: FindJobsSearchProps) {
  const formId = useId();
  const formHtmlId = `find-jobs-${formId.replace(/:/g, "")}`;
  const { toast } = useToast();

  const [suburb, setSuburb] = useState(initial?.suburb ?? "");
  const [postcode, setPostcode] = useState(initial?.postcode ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initial?.suburb ?? "");
  const [results, setResults] = useState<SuburbRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isLocating, setIsLocating] = useState(false);
  const [radiusKm, setRadiusKm] = useState(() => {
    const r = initial?.radius_km?.trim();
    const n = r ? Number(r) : NaN;
    if (Number.isFinite(n) && n > 0) return String(Math.min(100, Math.max(5, Math.round(n))));
    return String(defaultRadiusKm);
  });
  const [centerLat, setCenterLat] = useState<number | null>(() =>
    initial?.center_lat ? Number(initial.center_lat) : null
  );
  const [centerLon, setCenterLon] = useState<number | null>(() =>
    initial?.center_lon ? Number(initial.center_lon) : null
  );

  const [sort, setSort] = useState(initial?.sort?.trim() || "ending-soon");
  const [minPrice, setMinPrice] = useState(initial?.min_price ?? "");
  const [maxPrice, setMaxPrice] = useState(initial?.max_price ?? "");
  const [bedrooms, setBedrooms] = useState(initial?.bedrooms || "any");
  const [bathrooms, setBathrooms] = useState(initial?.bathrooms || "any");
  const [propertyType, setPropertyType] = useState(initial?.property_type || "any");

  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const supabase = createBrowserSupabaseClient();
    startTransition(async () => {
      const { data, error } = await supabase
        .from("suburbs")
        .select("suburb, postcode, state, lat, lon")
        .ilike("suburb", `%${query.trim()}%`)
        .order("suburb", { ascending: true })
        .limit(10);

      if (error) {
        setResults([]);
        return;
      }
      setResults((data ?? []) as SuburbRow[]);
    });
  }, [query]);

  const handleSelect = (row: SuburbRow) => {
    setSuburb(row.suburb);
    setPostcode(String(row.postcode ?? ""));
    setQuery(row.suburb);
    setOpen(false);
    if (typeof row.lat === "number" && typeof row.lon === "number") {
      setCenterLat(row.lat);
      setCenterLon(row.lon);
    }
  };

  const handleLocationInput: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = e.target.value;
    setSuburb(value);
    setQuery(value);
    if (value.trim() === "") {
      setPostcode("");
      setResults([]);
      setCenterLat(null);
      setCenterLon(null);
    } else {
      setOpen(true);
    }
  };

  const handlePostcodeChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
    setPostcode(value);
  };

  const handleUseLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      toast({
        variant: "destructive",
        title: "Location not supported",
        description: "Enter your suburb or postcode manually.",
      });
      return;
    }
    setIsLocating(true);
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
              Math.cos(toRad(latitude)) * Math.cos(toRad(row.lat)) * Math.sin(dLon / 2) ** 2;
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
          handleSelect(best);
          if (typeof best.lat === "number" && typeof best.lon === "number") {
            setCenterLat(best.lat);
            setCenterLon(best.lon);
          }
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
          setIsLocating(false);
        }
      },
      () => {
        toast({
          variant: "destructive",
          title: "Location unavailable",
          description: "Allow location or enter suburb manually.",
        });
        setIsLocating(false);
      },
      { enableHighAccuracy: false, timeout: 12000 }
    );
  };

  const isJobs = variant === "jobs";

  const handleClientSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!onNavigate) return;
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    appendFormToSearchParams(fd, params);
    const qs = params.toString();
    onNavigate(qs ? `/jobs?${qs}` : "/jobs");
  };

  return (
    <form
      id={formHtmlId}
      action={onNavigate ? undefined : "/jobs"}
      method="GET"
      onSubmit={onNavigate ? handleClientSubmit : undefined}
      className={cn("space-y-3", className)}
      aria-label="Find bond clean jobs"
    >
      {/* Main search row — Airtasker-style pill + icon */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
        <div className="relative min-w-0 flex-1">
          <MapPin
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <Input
            name="suburb"
            id={`${formHtmlId}-suburb`}
            value={suburb}
            onChange={handleLocationInput}
            onFocus={() => query.trim().length >= 2 && setOpen(true)}
            autoComplete="address-level2"
            placeholder="Suburb or area"
            className={cn(
              "h-12 min-h-[48px] rounded-2xl border-2 pl-10 pr-3 text-base shadow-sm",
              "placeholder:text-muted-foreground/80",
              "focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:bg-gray-900/80"
            )}
            aria-label="Suburb or area"
            aria-autocomplete="list"
            aria-expanded={open && results.length > 0}
          />
          {open && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-56 overflow-y-auto rounded-xl border-2 border-border bg-popover shadow-xl dark:border-gray-700 dark:bg-gray-900">
              {isPending && (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              )}
              {!isPending && results.length === 0 && (
                <div className="px-3 py-3 text-sm text-muted-foreground">No suburbs found</div>
              )}
              {!isPending &&
                results.map((row) => (
                  <button
                    key={`${row.suburb}-${row.postcode}-${row.state}`}
                    type="button"
                    className="flex w-full min-h-[48px] flex-col items-start justify-center px-3 py-2.5 text-left text-sm hover:bg-muted active:bg-muted/80 dark:hover:bg-gray-800"
                    onClick={() => handleSelect(row)}
                  >
                    <span className="font-semibold text-foreground">{row.suburb}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.postcode}
                      {row.state ? ` · ${row.state}` : ""}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>

        <div className="relative sm:w-28">
          <Input
            name="postcode"
            id={`${formHtmlId}-postcode`}
            value={postcode}
            onChange={handlePostcodeChange}
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="Postcode"
            className="h-12 min-h-[48px] rounded-2xl border-2 px-3 text-center text-base tabular-nums shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:bg-gray-900/80"
            aria-label="Postcode (optional)"
          />
        </div>
      </div>

      {/* Radius chips — thumb-sized, horizontal scroll on small screens */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-500">
          Distance
        </p>
        <div
          className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label="Search radius in kilometres"
        >
          {RADIUS_PRESETS.map((km) => {
            const active = Number(radiusKm) === km;
            return (
              <button
                key={km}
                type="button"
                onClick={() => setRadiusKm(String(km))}
                className={cn(
                  "shrink-0 snap-start rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
                  "min-h-[44px] min-w-[3.25rem] border-2",
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-md dark:border-emerald-500 dark:bg-emerald-600"
                    : "border-border bg-background text-foreground hover:border-emerald-500/50 hover:bg-emerald-50/80 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                )}
                aria-pressed={active}
                aria-label={`${km} kilometres`}
              >
                {km} km
              </button>
            );
          })}
        </div>
        <input type="hidden" name="radius_km" value={radiusKm} />
        <input
          type="hidden"
          name="center_lat"
          value={centerLat !== null && Number.isFinite(centerLat) ? String(centerLat) : ""}
        />
        <input
          type="hidden"
          name="center_lon"
          value={centerLon !== null && Number.isFinite(centerLon) ? String(centerLon) : ""}
        />
      </div>

      {/* Primary actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Button
          type="submit"
          size="lg"
          className="h-12 min-h-[48px] w-full rounded-2xl text-base font-semibold shadow-md sm:flex-1"
        >
          <Search className="mr-2 h-5 w-5 shrink-0" aria-hidden />
          Search jobs
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 min-h-[48px] w-full shrink-0 rounded-2xl border-2 sm:w-auto"
          onClick={handleUseLocation}
          disabled={isLocating}
          aria-label="Use my current location"
        >
          {isLocating ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Navigation className="mr-2 h-5 w-5" />
          )}
          Near me
        </Button>
      </div>

      {/* Advanced filters — jobs page only */}
      {isJobs && (
        <>
          <input type="hidden" name="sort" value={sort} readOnly />
          <input type="hidden" name="min_price" value={minPrice} readOnly />
          <input type="hidden" name="max_price" value={maxPrice} readOnly />
          <input type="hidden" name="bedrooms" value={bedrooms} readOnly />
          <input type="hidden" name="bathrooms" value={bathrooms} readOnly />
          <input type="hidden" name="property_type" value={propertyType} readOnly />

          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full rounded-2xl border border-border/80 text-base font-medium sm:w-auto"
              >
                <SlidersHorizontal className="mr-2 h-5 w-5" aria-hidden />
                More filters
                {(minPrice ||
                  maxPrice ||
                  (bedrooms && bedrooms !== "any") ||
                  (bathrooms && bathrooms !== "any") ||
                  (propertyType && propertyType !== "any")) && (
                  <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
                    Active
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl px-4 pb-6 pt-2" title="More filters">
              <div className="text-left">
                <SheetTitle className="text-lg">Refine results</SheetTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sort order, price range, and property details.
                </p>
              </div>
              <div className="mt-4 space-y-4 overflow-y-auto pb-4">
                <div className="space-y-2">
                  <Label htmlFor={`${formHtmlId}-sort`}>Sort by</Label>
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger id={`${formHtmlId}-sort`} className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ending-soon">Ending soon</SelectItem>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="price-asc">Price low to high</SelectItem>
                      <SelectItem value="price-desc">Price high to low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${formHtmlId}-min`}>Min price ($)</Label>
                    <Input
                      id={`${formHtmlId}-min`}
                      type="number"
                      min={0}
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="0"
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${formHtmlId}-max`}>Max price ($)</Label>
                    <Input
                      id={`${formHtmlId}-max`}
                      type="number"
                      min={0}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Any"
                      className="h-12 rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Bedrooms</Label>
                    <Select value={bedrooms} onValueChange={setBedrooms}>
                      <SelectTrigger className="h-12 rounded-xl">
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
                    <Label>Bathrooms</Label>
                    <Select value={bathrooms} onValueChange={setBathrooms}>
                      <SelectTrigger className="h-12 rounded-xl">
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
                  <Label>Property type</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger className="h-12 rounded-xl">
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
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-xl"
                  onClick={() => {
                    setSort("ending-soon");
                    setMinPrice("");
                    setMaxPrice("");
                    setBedrooms("any");
                    setBathrooms("any");
                    setPropertyType("any");
                  }}
                >
                  Reset filters
                </Button>
                <Button
                  type="submit"
                  form={formHtmlId}
                  className="h-12 w-full rounded-xl"
                  onClick={() => setFiltersOpen(false)}
                >
                  Apply & search
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </form>
  );
}
