"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  AU_STATES,
  filterSuburbs,
  type AuStateCode,
  type SuburbEntry,
} from "@/lib/au-suburbs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SuburbPostcodeAutocompleteProps = {
  stateValue: string;
  onStateChange: (state: AuStateCode) => void;
  suburbValue: string;
  postcodeValue: string;
  onSuburbPostcodeChange: (suburb: string, postcode: string) => void;
  id?: string;
  suburbPlaceholder?: string;
  disabled?: boolean;
  error?: string;
  /** When true, only suburb/postcode field is shown; all states are searched (optional state filter). */
  hideStateSelect?: boolean;
  /**
   * When true, suggestions come from the `suburbs` table (same as new listing / find jobs).
   * Defaults to `hideStateSelect` so signup gets full DB coverage; set false to use the static list only.
   */
  useDatabaseSuburbs?: boolean;
  /** Override default "Suburb & postcode" label */
  label?: string;
  className?: string;
  inputClassName?: string;
};

const BLUR_CLOSE_MS = 350;

function formatDisplayFromValues(suburb: string, postcode: string): string {
  const s = suburb?.trim() ?? "";
  const p = postcode?.trim() ?? "";
  if (s && p) return `${s} ${p}`;
  if (p && !s) return p;
  return s;
}

export function SuburbPostcodeAutocomplete({
  stateValue,
  onStateChange,
  suburbValue,
  postcodeValue,
  onSuburbPostcodeChange,
  id = "suburb",
  suburbPlaceholder = "Select state then type suburb or postcode",
  disabled,
  error,
  hideStateSelect = false,
  useDatabaseSuburbs = hideStateSelect,
  label = "Suburb & postcode",
  className,
  inputClassName,
}: SuburbPostcodeAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(() =>
    formatDisplayFromValues(suburbValue, postcodeValue)
  );
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [dbSuggestions, setDbSuggestions] = useState<
    { suburb: string; postcode: string | number; state: string | null }[]
  >([]);
  const [, startSuburbTransition] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);
  const blurCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    setInputValue(formatDisplayFromValues(suburbValue, postcodeValue));
  }, [suburbValue, postcodeValue]);

  const stateCode = stateValue as AuStateCode | undefined;
  const staticSuggestions = filterSuburbs(inputValue, stateCode ?? null);

  useEffect(() => {
    if (!useDatabaseSuburbs) {
      setDbSuggestions([]);
      return;
    }
    const q = inputValue.trim();
    if (q.length < 2) {
      setDbSuggestions([]);
      return;
    }
    startSuburbTransition(async () => {
      const { data, error } = await supabase
        .from("suburbs")
        .select("suburb, postcode, state")
        .ilike("suburb", `%${q}%`)
        .order("suburb", { ascending: true })
        .limit(10);
      if (!error) setDbSuggestions((data ?? []) as typeof dbSuggestions);
      else setDbSuggestions([]);
    });
  }, [inputValue, supabase, useDatabaseSuburbs]);

  const suggestions = useDatabaseSuburbs ? dbSuggestions : staticSuggestions;

  const handleStateChange = useCallback(
    (v: string) => onStateChange(v as AuStateCode),
    [onStateChange]
  );

  const handleSelect = useCallback(
    (
      entry:
        | SuburbEntry
        | { suburb: string; postcode: string | number; state: string | null }
    ) => {
      const pc = String(entry.postcode ?? "");
      onSuburbPostcodeChange(entry.suburb, pc);
      setInputValue(`${entry.suburb} ${pc}`);
      setOpen(false);
    },
    [onSuburbPostcodeChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    setOpen(true);
    setHighlightIndex(0);
    if (!v.trim()) {
      onSuburbPostcodeChange("", "");
    } else {
      onSuburbPostcodeChange(v.trim(), "");
    }
  };

  const clearBlurTimer = useCallback(() => {
    if (blurCloseTimerRef.current != null) {
      clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearBlurTimer();
    blurCloseTimerRef.current = setTimeout(() => {
      blurCloseTimerRef.current = null;
      setOpen(false);
    }, BLUR_CLOSE_MS);
  }, [clearBlurTimer]);

  useEffect(() => () => clearBlurTimer(), [clearBlurTimer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = suggestions[highlightIndex] as
        | SuburbEntry
        | { suburb: string; postcode: string | number; state: string | null }
        | undefined;
      if (selected) handleSelect(selected);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "grid gap-2",
          !hideStateSelect && "sm:grid-cols-2"
        )}
      >
        {!hideStateSelect && (
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Select
              value={stateValue || ""}
              onValueChange={handleStateChange}
              disabled={disabled}
            >
              <SelectTrigger id="state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {AU_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className={cn("space-y-1.5", hideStateSelect && "sm:col-span-1")}>
          <Label htmlFor={id} className={hideStateSelect ? "text-base" : undefined}>
            {label}
          </Label>
          <div className="relative z-20 overflow-visible">
            <Input
              id={id}
              type="text"
              placeholder={suburbPlaceholder}
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => {
                clearBlurTimer();
                setOpen(true);
              }}
              onBlur={scheduleClose}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              className={cn(
                "touch-manipulation",
                hideStateSelect && "min-h-12 text-base",
                inputClassName
              )}
            />
            {open && suggestions.length > 0 && (
              <ul
                ref={listRef}
                role="listbox"
                aria-label="Suburb suggestions"
                className="absolute left-0 right-0 z-[100] mt-1 max-h-[min(50vh,16rem)] w-full touch-pan-y overflow-y-auto overscroll-contain rounded-md border border-chromeBorder bg-chromeElevated py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
              >
                {suggestions.map((s, i) => {
                  const st = "state" in s && s.state != null ? s.state : "";
                  const key = `${st}-${s.suburb}-${s.postcode}`;
                  return (
                  <li
                    key={key}
                    role="option"
                    aria-selected={i === highlightIndex}
                    className={cn(
                      "cursor-pointer px-3 py-2.5 text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/90 dark:text-gray-100 dark:hover:bg-gray-800",
                      i === highlightIndex && "bg-accent text-accent-foreground dark:bg-gray-800"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(s);
                    }}
                  >
                    {st ? `${s.suburb}, ${s.postcode} (${st})` : `${s.suburb}, ${s.postcode}`}
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
