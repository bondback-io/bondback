"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import { clampMaxTravelKm, MAX_TRAVEL_KM, MIN_TRAVEL_KM } from "@/lib/max-travel-km";

type FindJobsMapRadiusControlProps = {
  radiusKm: number;
  /** Updates the map circle immediately while dragging (before URL commit). */
  onPreviewKmChange?: (km: number) => void;
};

/**
 * Updates `radius_km` in the URL so the server re-filters the list. Uses `startTransition` +
 * `scroll: false` so the route refresh feels softer than a full page jump.
 */
export function FindJobsMapRadiusControl({ radiusKm, onPreviewKmChange }: FindJobsMapRadiusControlProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const [local, setLocal] = React.useState(() => clampMaxTravelKm(radiusKm));

  React.useEffect(() => {
    setLocal(clampMaxTravelKm(radiusKm));
  }, [radiusKm]);

  const commit = React.useCallback(
    (km: number) => {
      const next = clampMaxTravelKm(km);
      setLocal(next);
      onPreviewKmChange?.(next);
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("radius_km", String(next));
      const href = `/find-jobs?${sp.toString()}`;
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [router, searchParams, onPreviewKmChange, startTransition]
  );

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 right-3 z-[1000] rounded-xl border border-border bg-background/95 p-3 shadow-md backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 lg:bottom-4 lg:left-auto lg:right-4 lg:w-72">
      <p className="mb-2 text-xs font-medium text-muted-foreground dark:text-gray-400">
        Search radius
        {isPending ? (
          <span className="ml-2 text-[10px] font-normal text-muted-foreground/80">Updating…</span>
        ) : null}
      </p>
      <div className="flex items-center gap-3">
        <Slider
          min={MIN_TRAVEL_KM}
          max={MAX_TRAVEL_KM}
          step={5}
          value={[local]}
          onValueChange={(v) => {
            const n = clampMaxTravelKm(v[0] ?? local);
            setLocal(n);
            onPreviewKmChange?.(n);
          }}
          onValueCommit={(v) => commit(v[0] ?? local)}
          className="flex-1 py-1"
          aria-label="Search radius in kilometres"
        />
        <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground dark:text-gray-100">
          {local} km
        </span>
      </div>
    </div>
  );
}
