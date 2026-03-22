"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, MapPin, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type SuburbRow = {
  suburb: string;
  postcode: string | number;
  state: string | null;
};

export type MobileMenuSearchProps = {
  /** Called before navigation (e.g. close the sheet). */
  onNavigate?: () => void;
  className?: string;
};

export function MobileMenuSearch({ onNavigate, className }: MobileMenuSearchProps) {
  const router = useRouter();
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SuburbRow[]>([]);
  const [isPending, startTransition] = useTransition();

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
  };

  const handleSuburbChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = e.target.value;
    setSuburb(value);
    setQuery(value);
    if (value.trim() === "") {
      setPostcode("");
      setResults([]);
    } else {
      setOpen(true);
    }
  };

  const handlePostcodeChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
    setPostcode(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const s = suburb.trim();
    const p = postcode.trim();
    if (s) params.set("suburb", s);
    if (p) params.set("postcode", p);
    const qs = params.toString();
    const url = qs ? `/jobs?${qs}` : "/jobs";
    onNavigate?.();
    router.push(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <section
      className={cn("space-y-3 pb-4", className)}
      aria-label="Search bond cleans in your area"
    >
      <form onSubmit={handleSubmit} className="space-y-3" onKeyDown={handleKeyDown}>
        <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">
          Search bond cleans in your area
        </p>
        <div className="space-y-2">
          <Label htmlFor="mobile-search-suburb" className="sr-only">
            Suburb
          </Label>
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-gray-500"
              aria-hidden
            />
            <Input
              id="mobile-search-suburb"
              type="text"
              value={suburb}
              onChange={handleSuburbChange}
              onFocus={() => suburb.trim().length >= 2 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              autoComplete="address-level2"
              placeholder="Suburb"
              className="h-10 pl-9 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
              aria-label="Suburb"
              aria-autocomplete="list"
              aria-expanded={open && results.length > 0}
              aria-controls="mobile-suburb-listbox"
            />
            {open && query.trim().length >= 2 && (
              <ul
                id="mobile-suburb-listbox"
                role="listbox"
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-background shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                {isPending && (
                  <li className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground dark:text-gray-400">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    Searching…
                  </li>
                )}
                {!isPending && results.length === 0 && (
                  <li className="px-3 py-2 text-xs text-muted-foreground dark:text-gray-400">
                    No suburbs found
                  </li>
                )}
                {!isPending &&
                  results.map((row) => (
                    <li key={`${row.suburb}-${row.postcode}`} role="option">
                      <button
                        type="button"
                        className="flex w-full cursor-pointer flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-gray-700 dark:focus:bg-gray-700 dark:text-gray-100"
                        onClick={() => handleSelect(row)}
                      >
                        <span className="font-medium">{row.suburb}</span>
                        <span className="text-xs text-muted-foreground dark:text-gray-400">
                          {row.postcode}
                          {row.state ? `, ${row.state}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile-search-postcode" className="sr-only">
            Postcode (4 digits)
          </Label>
          <div className="relative">
            <Hash
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-gray-500"
              aria-hidden
            />
            <Input
              id="mobile-search-postcode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={postcode}
              onChange={handlePostcodeChange}
              placeholder="Postcode (4 digits)"
              className="h-10 pl-9 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
              aria-label="Postcode, 4 digits"
            />
          </div>
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
          aria-label="Search bond cleans"
        >
          <Search className="mr-2 h-4 w-4" aria-hidden />
          Search
        </Button>
      </form>
    </section>
  );
}
