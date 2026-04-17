"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { useFindJobsMap } from "@/components/find-jobs/find-jobs-map-context";
import { FindJobsMapPaneSkeleton } from "@/components/find-jobs/find-jobs-map-skeleton";
import { FindJobsDetailPanelBody } from "@/components/find-jobs/find-jobs-detail-slide-panel";
import { cn } from "@/lib/utils";

function useLgUp() {
  const [lgUp, setLgUp] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setLgUp(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return lgUp;
}

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
 * Desktop: job detail overlays the map. The Leaflet map stays mounted so teardown does not throw.
 * Mobile: map column is hidden; details use {@link FindJobsMobileDetailSheet}.
 */
export function FindJobsRightPane({ centerLat, centerLon, radiusKm }: FindJobsRightPaneProps) {
  const reduceMotion = useReducedMotion();
  const lgUp = useLgUp();
  const { detailListing, setDetailListing, mapPoints } = useFindJobsMap();

  const showDetailOverlay = Boolean(detailListing && lgUp);

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
          initial={reduceMotion ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden bg-background"
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
