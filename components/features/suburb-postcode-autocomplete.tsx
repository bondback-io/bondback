"use client";

import { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
};

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
}: SuburbPostcodeAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(
    suburbValue && postcodeValue ? `${suburbValue} ${postcodeValue}` : suburbValue || ""
  );
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const stateCode = stateValue as AuStateCode | undefined;
  const suggestions = filterSuburbs(inputValue, stateCode ?? null);

  const handleStateChange = useCallback(
    (v: string) => onStateChange(v as AuStateCode),
    [onStateChange]
  );

  const handleSelect = useCallback(
    (entry: SuburbEntry) => {
      onSuburbPostcodeChange(entry.suburb, entry.postcode);
      setInputValue(`${entry.suburb} ${entry.postcode}`);
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
      const selected = suggestions[highlightIndex];
      if (selected) handleSelect(selected);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
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
        <div className="space-y-1.5">
          <Label htmlFor={id}>Suburb & postcode</Label>
          <div className="relative">
            <Input
              id={id}
              type="text"
              placeholder={suburbPlaceholder}
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              autoComplete="off"
            />
            {open && suggestions.length > 0 && (
              <ul
                ref={listRef}
                className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md"
              >
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.state}-${s.suburb}-${s.postcode}`}
                    className={cn(
                      "cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground",
                      i === highlightIndex && "bg-accent text-accent-foreground"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(s);
                    }}
                  >
                    {s.suburb}, {s.postcode} ({s.state})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
