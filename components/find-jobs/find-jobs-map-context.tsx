"use client";

import * as React from "react";
import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";
import type { ListingRow } from "@/lib/listings";

export type { FindJobsMapPoint };

export type FindJobsMapFocusRequest = { id: string; seq: number };

export type FindJobsViewerActiveRole = "lister" | "cleaner" | null;

type FindJobsMapContextValue = {
  /** Listing id highlighted from map pin click (scroll list + ring card). */
  highlightedListingId: string | null;
  setHighlightedListingId: (id: string | null) => void;
  /** Request map to center + open popup for this listing (from list click). `seq` bumps each time so repeat clicks re-run focus). */
  mapFocusRequest: FindJobsMapFocusRequest | null;
  requestMapFocus: (listingId: string) => void;
  clearMapFocusRequest: () => void;
  /** Slide-in detail panel (Airtasker-style). */
  detailListing: ListingRow | null;
  setDetailListing: (listing: ListingRow | null) => void;
  registerListings: (listings: ListingRow[]) => void;
  getListingById: (id: string) => ListingRow | undefined;
  /** Merge fields into open detail listing + list registry (e.g. after a successful bid). */
  patchDetailListingRow: (listingId: string, patch: Partial<ListingRow>) => void;
  viewerIsCleaner: boolean;
  viewerUserId: string | null;
  viewerActiveRole: FindJobsViewerActiveRole;
};

const FindJobsMapContext = React.createContext<FindJobsMapContextValue | null>(null);

type FindJobsMapProviderProps = {
  children: React.ReactNode;
  viewerIsCleaner?: boolean;
  viewerUserId?: string | null;
  viewerActiveRole?: FindJobsViewerActiveRole;
};

export function FindJobsMapProvider({
  children,
  viewerIsCleaner = false,
  viewerUserId = null,
  viewerActiveRole = null,
}: FindJobsMapProviderProps) {
  const [highlightedListingId, setHighlightedListingId] = React.useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = React.useState<FindJobsMapFocusRequest | null>(null);
  const [detailListing, setDetailListing] = React.useState<ListingRow | null>(null);
  const listingsByIdRef = React.useRef<Map<string, ListingRow>>(new Map());

  const registerListings = React.useCallback((listings: ListingRow[]) => {
    const m = listingsByIdRef.current;
    m.clear();
    for (const row of listings) {
      m.set(String(row.id), row);
    }
  }, []);

  const getListingById = React.useCallback((id: string) => listingsByIdRef.current.get(id), []);

  const patchDetailListingRow = React.useCallback((listingId: string, patch: Partial<ListingRow>) => {
    const sid = String(listingId);
    setDetailListing((prev) => {
      if (!prev || String(prev.id) !== sid) return prev;
      return { ...prev, ...patch } as ListingRow;
    });
    const m = listingsByIdRef.current;
    const row = m.get(sid);
    if (row) {
      m.set(sid, { ...row, ...patch } as ListingRow);
    }
  }, []);

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
      detailListing,
      setDetailListing,
      registerListings,
      getListingById,
      patchDetailListingRow,
      viewerIsCleaner,
      viewerUserId,
      viewerActiveRole,
    }),
    [
      highlightedListingId,
      mapFocusRequest,
      requestMapFocus,
      clearMapFocusRequest,
      detailListing,
      registerListings,
      getListingById,
      patchDetailListingRow,
      viewerIsCleaner,
      viewerUserId,
      viewerActiveRole,
    ]
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
