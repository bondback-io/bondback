"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import { Search, Loader2, MapPin, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

type SuburbRow = {
  suburb: string;
  postcode: string | number;
  state: string | null;
};

type SuburbPostcodeSearchProps = {
  className?: string;
};

export function SuburbPostcodeSearch({ className }: SuburbPostcodeSearchProps) {
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SuburbRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isLocating, setIsLocating] = useState(false);
  const [radius, setRadius] = useState("20");
  const handleRadiusChange = React.useCallback((v: string) => setRadius(v), []);
  const [centerLat, setCenterLat] = useState<number | null>(null);
  const [centerLon, setCenterLon] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch suburbs when query changes
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const supabase = createBrowserSupabaseClient();

    startTransition(async () => {
      const { data, error } = await supabase
        .from("suburbs")
        .select("suburb, postcode, state")
        .ilike("suburb", `%${query.trim()}%`)
        .order("suburb", { ascending: true })
        .limit(10);

      if (error) {
        console.error("Error fetching suburbs", error);
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
    // For now, let radius filtering rely on postcode/suburb server-side.
    // Center coordinates are only set when using browser geolocation.
  };

  const handleSuburbChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
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
        description: "Your browser does not support geolocation. Please enter your suburb manually.",
      });
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const supabase = createBrowserSupabaseClient();

          // Try to fetch suburbs with lat/lon to compute nearest client-side.
          const { data, error } = await supabase
            .from("suburbs")
            .select("suburb, postcode, state, lat, lon")
            .limit(2000);

          if (error || !data || !data.length) {
            toast({
              title: "Location not supported yet",
              description:
                "We couldn't find location data for suburbs. Please type your suburb and postcode manually.",
            });
            return;
          }

          type RowWithCoords = SuburbRow & { lat: number | null; lon: number | null };
          const rows = data as RowWithCoords[];

          const toRad = (deg: number) => (deg * Math.PI) / 180;
          const R = 6371; // km

          let best: RowWithCoords | null = null;
          let bestDist = Infinity;

          for (const row of rows) {
            if (row.lat == null || row.lon == null) continue;
            const dLat = toRad(row.lat - latitude);
            const dLon = toRad(row.lon - longitude);
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(latitude)) *
                Math.cos(toRad(row.lat)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const d = R * c;
            if (d < bestDist) {
              bestDist = d;
              best = row;
            }
          }

          if (!best) {
            toast({
              title: "Location not supported yet",
              description:
                "We couldn't match your location to a suburb. Please enter your suburb manually.",
            });
            return;
          }

          handleSelect(best);
          if (typeof best.lat === "number" && typeof best.lon === "number") {
            setCenterLat(best.lat);
            setCenterLon(best.lon);
          }
          toast({
            title: "Location detected",
            description: `Using ${best.suburb} ${best.postcode}${
              best.state ? `, ${best.state}` : ""
            }`,
          });
        } catch (err) {
          console.error("Error using geolocation", err);
          toast({
            variant: "destructive",
            title: "Location error",
            description: "Something went wrong while using your location. Please enter suburb manually.",
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Geolocation error", error);
        let message = "Location access denied – please enter suburb manually.";
        if (error.code === error.TIMEOUT) {
          message = "Location request timed out – please try again or enter suburb manually.";
        }
        toast({
          variant: "destructive",
          title: "Location unavailable",
          description: message,
        });
        setIsLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  return (
    <form
      action="/jobs"
      method="GET"
      className={cn("space-y-4", className)}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="suburb">Suburb</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-gray-500" />
            <Input
              id="suburb"
              name="suburb"
              value={suburb}
              onChange={handleSuburbChange}
              autoComplete="address-level2"
              placeholder="e.g. LITTLE MOUNTAIN"
              className="pl-9 transition-transform focus:scale-[1.02]"
            />
            {/* Autocomplete dropdown */}
            {open && suburb.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-background shadow-2xl dark:border-gray-700 dark:bg-gray-900">
                {isPending && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground dark:text-gray-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Searching suburbs…
                  </div>
                )}
                {!isPending && results.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground dark:text-gray-400">
                    No suburbs found
                  </div>
                )}
                {!isPending &&
                  results.map((row) => (
                    <button
                      key={`${row.suburb}-${row.postcode}-${row.state}`}
                      type="button"
                      className="flex w-full cursor-pointer flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted dark:hover:bg-gray-700"
                      onClick={() => handleSelect(row)}
                    >
                      <span className="font-medium text-foreground dark:text-gray-100">{row.suburb}</span>
                      <span className="text-xs text-muted-foreground dark:text-gray-400">
                        {row.postcode}
                        {row.state ? `, ${row.state}` : ""}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Start typing your suburb. We&apos;ll suggest matching suburbs and auto-fill the
            postcode.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postcode">Postcode</Label>
          <div className="relative">
            <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-gray-500" />
            <Input
              id="postcode"
              name="postcode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={postcode}
              onChange={handlePostcodeChange}
              placeholder="e.g. 4551"
              className="pl-9 transition-transform focus:scale-[1.02]"
            />
          </div>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            4‑digit Australian postcode (e.g. 4000, 4551). We&apos;ll auto-fill when you choose a
            suburb.
          </p>
        </div>
      </div>

      {/* Radius selection */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="radius">Within</Label>
          <div className="flex items-center gap-2">
            <Select value={radius} onValueChange={handleRadiusChange}>
              <SelectTrigger id="radius" className="w-32">
                <SelectValue placeholder="20 km" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 km</SelectItem>
                <SelectItem value="10">10 km</SelectItem>
                <SelectItem value="20">20 km</SelectItem>
                <SelectItem value="50">50 km</SelectItem>
                <SelectItem value="100">100 km</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground dark:text-gray-400">radius</span>
          </div>
          <input type="hidden" name="radius_km" value={radius} />
          <input
            type="hidden"
            name="center_lat"
            value={centerLat !== null ? String(centerLat) : ""}
          />
          <input
            type="hidden"
            name="center_lon"
            value={centerLon !== null ? String(centerLon) : ""}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground dark:text-gray-400">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleUseLocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <MapPin className="h-3 w-3" />
            )}
            <span>Use my location</span>
          </Button>
        </div>
        <Button
          type="submit"
          size="lg"
          className="rounded-full px-8 text-sm font-semibold shadow-sm hover:shadow-md"
        >
          <Search className="mr-2 h-4 w-4" />
          Search Bond Cleans
        </Button>
      </div>
    </form>
  );
}

