"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import { clampMaxTravelKm, MAX_TRAVEL_KM, MIN_TRAVEL_KM } from "@/lib/max-travel-km";

/**
 * Updates `radius_km` in the URL so the server re-filters the list and map circle.
 */
export function FindJobsMapRadiusControl({ radiusKm }: { radiusKm: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [local, setLocal] = React.useState(() => clampMaxTravelKm(radiusKm));

  React.useEffect(() => {
    setLocal(clampMaxTravelKm(radiusKm));
  }, [radiusKm]);

  const commit = React.useCallback(
    (km: number) => {
      const next = clampMaxTravelKm(km);
      setLocal(next);
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("radius_km", String(next));
      router.replace(`/find-jobs?${sp.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 right-3 z-[1000] rounded-xl border border-border bg-background/95 p-3 shadow-md backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 lg:bottom-4 lg:left-auto lg:right-4 lg:w-72">
      <p className="mb-2 text-xs font-medium text-muted-foreground dark:text-gray-400">
        Search radius
      </p>
      <div className="flex items-center gap-3">
        <Slider
          min={MIN_TRAVEL_KM}
          max={MAX_TRAVEL_KM}
          step={5}
          value={[local]}
          onValueChange={(v) => {
            const n = v[0] ?? local;
            setLocal(clampMaxTravelKm(n));
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
