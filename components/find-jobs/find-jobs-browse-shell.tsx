"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { FindJobsMapProvider } from "@/components/find-jobs/find-jobs-map-context";
import { FindJobsSplitLayout } from "@/components/features/find-jobs-split-layout";
import { FindJobsMapPaneSkeleton } from "@/components/find-jobs/find-jobs-map-skeleton";
import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";

const FindJobsMapDynamic = dynamic(
  () => import("./find-jobs-map-pane").then((m) => m.FindJobsMapPane),
  {
    ssr: false,
    loading: () => <FindJobsMapPaneSkeleton />,
  }
);

export type FindJobsBrowseShellProps = {
  children: ReactNode;
  mapPoints: FindJobsMapPoint[];
  centerLat: number;
  centerLon: number;
  radiusKm: number;
};

export function FindJobsBrowseShell({
  children,
  mapPoints,
  centerLat,
  centerLon,
  radiusKm,
}: FindJobsBrowseShellProps) {
  return (
    <FindJobsMapProvider>
      <FindJobsSplitLayout
        list={children}
        mapPlaceholder={
          <FindJobsMapDynamic
            points={mapPoints}
            centerLat={centerLat}
            centerLon={centerLon}
            radiusKm={radiusKm}
          />
        }
      />
    </FindJobsMapProvider>
  );
}
