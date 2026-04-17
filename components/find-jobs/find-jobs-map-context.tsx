"use client";

import * as React from "react";
import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";

export type { FindJobsMapPoint };

export type FindJobsMapFocusRequest = { id: string; seq: number };

type FindJobsMapContextValue = {
  /** Listing id highlighted from map pin click (scroll list + ring card). */
  highlightedListingId: string | null;
  setHighlightedListingId: (id: string | null) => void;
  /** Request map to center + open popup for this listing (from list click). `seq` bumps each time so repeat clicks re-run focus). */
  mapFocusRequest: FindJobsMapFocusRequest | null;
  requestMapFocus: (listingId: string) => void;
  clearMapFocusRequest: () => void;
};

const FindJobsMapContext = React.createContext<FindJobsMapContextValue | null>(null);

export function FindJobsMapProvider({ children }: { children: React.ReactNode }) {
  const [highlightedListingId, setHighlightedListingId] = React.useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = React.useState<FindJobsMapFocusRequest | null>(null);

  const requestMapFocus = React.useCallback((listingId: string) => {
    setMapFocusRequest((prev) => ({
      id: listingId,
      seq: (prev?.seq ?? 0) + 1,
    }));
    setHighlightedListingId(listingId);
  }, []);

  const clearMapFocusRequest = React.useCallback(() => {
    setMapFocusRequest(null);
  }, []);

  const value = React.useMemo(
    () => ({
      highlightedListingId,
      setHighlightedListingId,
      mapFocusRequest,
      requestMapFocus,
      clearMapFocusRequest,
    }),
    [highlightedListingId, mapFocusRequest, requestMapFocus, clearMapFocusRequest]
  );

  return <FindJobsMapContext.Provider value={value}>{children}</FindJobsMapContext.Provider>;
}

export function useFindJobsMap() {
  const ctx = React.useContext(FindJobsMapContext);
  if (!ctx) throw new Error("useFindJobsMap must be used within FindJobsMapProvider");
  return ctx;
}

export function useFindJobsMapOptional() {
  return React.useContext(FindJobsMapContext);
}
