"use client";

import * as React from "react";
import { useState, useEffect, useTransition, useId } from "react";
import { Loader2, MapPin, Navigation, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { useDistanceUnit } from "@/hooks/use-distance-unit";
import { formatRadiusPresetLabel } from "@/lib/distance-format";

const RADIUS_PRESETS = [5, 10, 20, 50, 100] as const;

type SuburbRow = {
  suburb: string;
  postcode: string | number;
  state: string | null;
  lat?: number | null;
  lon?: number | null;
};

export type BrowseCleanersSearchInitial = {
  suburb?: string;
  postcode?: string;
  radius_km?: string;
  center_lat?: string;
  center_lon?: string;
};

export function BrowseCleanersSearch({
  className,
  initial,
  defaultRadiusKm = 30,
}: {
  className?: string;
  initial?: BrowseCleanersSearchInitial;
  defaultRadiusKm?: number;
}) {
  const formId = useId();
  const formHtmlId = `browse-cleaners-${formId.replace(/:/g, "")}`;
  const { toast } = useToast();
  const distanceUnit = useDistanceUnit();

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

  return (
    <form
      id={formHtmlId}
      action="/cleaners"
      method="GET"
      className={cn("space-y-3", className)}
      aria-label="Find cleaners near you"
    >
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
            placeholder="Your suburb or area"
            className={cn(
              "h-12 min-h-[48px] rounded-2xl border-2 border-border bg-background pl-10 pr-3 text-base text-foreground shadow-sm",
              "placeholder:text-muted-foreground",
              "focus-visible:ring-2 focus-visible:ring-emerald-500/40",
              "dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
            )}
            aria-label="Suburb or area"
            aria-autocomplete="list"
            aria-expanded={open && results.length > 0}
          />
          {open && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-56 overflow-y-auto rounded-xl border-2 border-border bg-popover shadow-xl dark:border-gray-600 dark:bg-gray-950">
              {isPending && (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              )}
              {!isPending && results.length === 0 && (
                <div className="px-3 py-3 text-sm text-muted-foreground dark:text-gray-400">
                  No suburbs found
                </div>
              )}
              {!isPending &&
                results.map((row) => (
                  <button
                    key={`${row.suburb}-${row.postcode}-${row.state}`}
                    type="button"
                    className="flex w-full min-h-[48px] flex-col items-start justify-center px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted active:bg-muted/80 dark:text-gray-100 dark:hover:bg-gray-800/90 dark:active:bg-gray-800"
                    onClick={() => handleSelect(row)}
                  >
                    <span className="font-semibold">{row.suburb}</span>
                    <span className="text-xs text-muted-foreground dark:text-gray-400">
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
            className="h-12 min-h-[48px] rounded-2xl border-2 border-border bg-background px-3 text-center text-base tabular-nums text-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
            aria-label="Postcode (optional)"
          />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
          Search radius
        </p>
        <div
          className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label={
            distanceUnit === "mi" ? "Radius (miles shown; search uses km)" : "Radius in kilometres"
          }
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
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-md dark:border-emerald-500 dark:bg-emerald-600 dark:text-white"
                    : "border-border bg-background text-foreground hover:border-emerald-500/50 hover:bg-emerald-50/80 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-emerald-500/40 dark:hover:bg-gray-800/90"
                )}
                aria-pressed={active}
                aria-label={`${formatRadiusPresetLabel(km, distanceUnit)} radius`}
              >
                {formatRadiusPresetLabel(km, distanceUnit)}
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Button
          type="submit"
          size="lg"
          className="h-12 min-h-[48px] w-full rounded-2xl text-base font-semibold shadow-md sm:flex-1"
        >
          <Search className="mr-2 h-5 w-5 shrink-0" aria-hidden />
          Search cleaners
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 min-h-[48px] w-full shrink-0 rounded-2xl border-2 border-border bg-background text-foreground hover:bg-muted active:bg-muted/80 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
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
    </form>
  );
}
