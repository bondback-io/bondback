"use client";

import * as React from "react";
import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";
import { listingsToFindJobsMapPoints } from "@/lib/find-jobs/map-points-from-listings";
import type { ListingRow } from "@/lib/listings";
import type { ListerCardData } from "@/lib/lister-card-data";

export type { FindJobsMapPoint };

export type FindJobsMapFocusRequest = { id: string; seq: number };

export type FindJobsViewerActiveRole = "lister" | "cleaner" | null;

type FindJobsMapContextValue = {
  /** Pins derived from the same filtered list as the left column (keeps map + list in sync). */
  mapPoints: FindJobsMapPoint[];
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
  registerListings: (
    listings: ListingRow[],
    listerCardByListingId?: Record<string, ListerCardData>
  ) => void;
  getListingById: (id: string) => ListingRow | undefined;
  getListerCardData: (listingId: string) => ListerCardData | undefined;
  /** Merge fields into open detail listing + list registry (e.g. after a successful bid). */
  patchDetailListingRow: (listingId: string, patch: Partial<ListingRow>) => void;
  viewerIsCleaner: boolean;
  viewerUserId: string | null;
  viewerActiveRole: FindJobsViewerActiveRole;
};

const FindJobsMapContext = React.createContext<FindJobsMapContextValue | null>(null);

type FindJobsMapProviderProps = {
  children: React.ReactNode;
  /** SSR pins until the jobs list registers client-filtered rows. */
  initialMapPoints?: FindJobsMapPoint[];
  viewerIsCleaner?: boolean;
  viewerUserId?: string | null;
  viewerActiveRole?: FindJobsViewerActiveRole;
};

export function FindJobsMapProvider({
  children,
  initialMapPoints = [],
  viewerIsCleaner = false,
  viewerUserId = null,
  viewerActiveRole = null,
}: FindJobsMapProviderProps) {
  const [mapPoints, setMapPoints] = React.useState<FindJobsMapPoint[]>(initialMapPoints);
  const [highlightedListingId, setHighlightedListingId] = React.useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = React.useState<FindJobsMapFocusRequest | null>(null);
  const [detailListing, setDetailListing] = React.useState<ListingRow | null>(null);
  const listingsByIdRef = React.useRef<Map<string, ListingRow>>(new Map());
  const listerCardByListingIdRef = React.useRef<Record<string, ListerCardData>>({});

  React.useEffect(() => {
    setMapPoints(initialMapPoints);
  }, [initialMapPoints]);

  const registerListings = React.useCallback(
    (listings: ListingRow[], listerCardByListingId?: Record<string, ListerCardData>) => {
      const m = listingsByIdRef.current;
      m.clear();
      for (const row of listings) {
        m.set(String(row.id), row);
      }
      listerCardByListingIdRef.current = { ...(listerCardByListingId ?? {}) };
      setMapPoints(listingsToFindJobsMapPoints(listings));
    },
    []
  );

  const getListingById = React.useCallback((id: string) => listingsByIdRef.current.get(id), []);

  const getListerCardData = React.useCallback(
    (listingId: string) => listerCardByListingIdRef.current[String(listingId)],
    []
  );

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
      mapPoints,
      highlightedListingId,
      setHighlightedListingId,
      mapFocusRequest,
      requestMapFocus,
      clearMapFocusRequest,
      detailListing,
      setDetailListing,
      registerListings,
      getListingById,
      getListerCardData,
      patchDetailListingRow,
      viewerIsCleaner,
      viewerUserId,
      viewerActiveRole,
    }),
    [
      mapPoints,
      highlightedListingId,
      mapFocusRequest,
      requestMapFocus,
      clearMapFocusRequest,
      detailListing,
      registerListings,
      getListingById,
      getListerCardData,
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
