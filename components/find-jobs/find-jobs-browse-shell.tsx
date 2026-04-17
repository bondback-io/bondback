"use client";

import type { ReactNode } from "react";
import {
  FindJobsMapProvider,
  type FindJobsViewerActiveRole,
} from "@/components/find-jobs/find-jobs-map-context";
import { FindJobsSplitLayout } from "@/components/features/find-jobs-split-layout";
import { FindJobsRightPane } from "@/components/find-jobs/find-jobs-right-pane";
import { FindJobsMobileDetailSheet } from "@/components/find-jobs/find-jobs-detail-slide-panel";
import type { FindJobsMapPoint } from "@/lib/find-jobs/map-types";

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
      initialMapPoints={mapPoints}
      viewerIsCleaner={viewerIsCleaner}
      viewerUserId={viewerUserId}
      viewerActiveRole={viewerActiveRole}
    >
      <FindJobsSplitLayout
        list={children}
        mapPlaceholder={
          <FindJobsRightPane centerLat={centerLat} centerLon={centerLon} radiusKm={radiusKm} />
        }
      />
      <FindJobsMobileDetailSheet />
    </FindJobsMapProvider>
  );
}
