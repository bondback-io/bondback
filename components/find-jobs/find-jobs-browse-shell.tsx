"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  FindJobsMapProvider,
  type FindJobsViewerActiveRole,
} from "@/components/find-jobs/find-jobs-map-context";
import { FindJobsSplitLayout } from "@/components/features/find-jobs-split-layout";
import { FindJobsMapPaneSkeleton } from "@/components/find-jobs/find-jobs-map-skeleton";
import {
  FindJobsDetailSlidePanel,
  FindJobsMobileDetailSheet,
} from "@/components/find-jobs/find-jobs-detail-slide-panel";
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
  viewerIsCleaner?: boolean;
  viewerUserId?: string | null;
  viewerActiveRole?: FindJobsViewerActiveRole;
};

export function FindJobsBrowseShell({
  children,
  mapPoints,
  centerLat,
  centerLon,
  radiusKm,
  viewerIsCleaner = false,
  viewerUserId = null,
  viewerActiveRole = null,
}: FindJobsBrowseShellProps) {
  return (
    <FindJobsMapProvider
      viewerIsCleaner={viewerIsCleaner}
      viewerUserId={viewerUserId}
      viewerActiveRole={viewerActiveRole}
    >
      <FindJobsSplitLayout
        list={children}
        mapPlaceholder={
          <div className="relative h-full min-h-[280px] w-full min-w-0 overflow-hidden">
            <FindJobsMapDynamic
              points={mapPoints}
              centerLat={centerLat}
              centerLon={centerLon}
              radiusKm={radiusKm}
            />
            <FindJobsDetailSlidePanel />
          </div>
        }
      />
      <FindJobsMobileDetailSheet />
    </FindJobsMapProvider>
  );
}
