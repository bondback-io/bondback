"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useFindJobsMap } from "@/components/find-jobs/find-jobs-map-context";
import { FindJobsMapPaneSkeleton } from "@/components/find-jobs/find-jobs-map-skeleton";
import { FindJobsDetailPanelBody } from "@/components/find-jobs/find-jobs-detail-slide-panel";

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
 * Desktop: toggles between full-width map and full-width job detail (same click on list toggles back).
 */
export function FindJobsRightPane({ centerLat, centerLon, radiusKm }: FindJobsRightPaneProps) {
  const reduceMotion = useReducedMotion();
  const lgUp = useLgUp();
  const { detailListing, setDetailListing, mapPoints } = useFindJobsMap();

  /** Mobile map sheet always shows the map; job details use {@link FindJobsMobileDetailSheet}. */
  const showDetailReplacingMap = Boolean(detailListing && lgUp);

  return (
    <div className="relative h-full min-h-[280px] w-full min-w-0 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {!showDetailReplacingMap ? (
          <motion.div
            key="fj-map"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <FindJobsMapDynamic
              points={mapPoints}
              centerLat={centerLat}
              centerLon={centerLon}
              radiusKm={radiusKm}
            />
          </motion.div>
        ) : detailListing ? (
          <motion.div
            key={`fj-detail-${detailListing.id}`}
            initial={reduceMotion ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-background"
          >
            <FindJobsDetailPanelBody
              listing={detailListing}
              onBack={() => setDetailListing(null)}
              backLabel="Back to map"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
