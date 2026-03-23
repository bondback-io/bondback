"use client";

import { useEffect } from "react";
import type { DistanceUnit } from "@/lib/distance-format";
import { setDistanceUnitClient } from "@/hooks/use-distance-unit";

type Props = {
  distanceUnit: DistanceUnit;
};

/** Keeps distance display (cards, search chips) in sync with profiles.distance_unit after load / refresh. */
export function UserPreferencesHydration({ distanceUnit }: Props) {
  useEffect(() => {
    setDistanceUnitClient(distanceUnit);
  }, [distanceUnit]);

  return null;
}
