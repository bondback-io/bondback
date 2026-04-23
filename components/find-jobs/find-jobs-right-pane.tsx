"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { useFindJobsMap } from "@/components/find-jobs/find-jobs-map-context";
import { FindJobsMapPaneSkeleton } from "@/components/find-jobs/find-jobs-map-skeleton";
import {
  FindJobsDetailPanelBody,
  FIND_JOBS_DETAIL_SURFACE_CLASS,
} from "@/components/find-jobs/find-jobs-detail-slide-panel";
import { useFindJobsDesktopDetailOverlay } from "@/components/find-jobs/use-find-jobs-desktop-detail";
import { cn } from "@/lib/utils";

const FindJobsMapDynamic = dynamic(
  () => import("./find-jobs-map-pane").then((m) => m.FindJobsMapPane),
  {
    ssr: false,
    loading: () => <FindJobsMapPaneSkeleton />,
  }
);

export type FindJobsRightPaneProps = {
  centerLat: number;
  centerLon: number;
  radiusKm: number;
};

/**
 * Wide desktop (xl+): job detail overlays the map column. Below xl, details use
 * {@link FindJobsMobileDetailSheet} so the panel is not squeezed beside the list.
 */
export function FindJobsRightPane({ centerLat, centerLon, radiusKm }: FindJobsRightPaneProps) {
  const reduceMotion = useReducedMotion();
  const desktopDetailOverlay = useFindJobsDesktopDetailOverlay();
  const { detailListing, setDetailListing, mapPoints } = useFindJobsMap();

  const showDetailOverlay = Boolean(detailListing && desktopDetailOverlay);

  return (
    <div className="relative h-full min-h-[280px] w-full min-w-0 overflow-hidden">
      <div
        className={cn(
          "absolute inset-0",
          showDetailOverlay && "pointer-events-none invisible opacity-0"
        )}
        aria-hidden={showDetailOverlay ? true : undefined}
      >
        <FindJobsMapDynamic
          points={mapPoints}
          centerLat={centerLat}
          centerLon={centerLon}
          radiusKm={radiusKm}
        />
      </div>
      {showDetailOverlay && detailListing ? (
        <motion.div
          key={`fj-detail-${detailListing.id}`}
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden",
            FIND_JOBS_DETAIL_SURFACE_CLASS
          )}
        >
          <FindJobsDetailPanelBody
            listing={detailListing}
            onBack={() => setDetailListing(null)}
            backLabel="Back to map"
          />
        </motion.div>
      ) : null}
    </div>
  );
}
