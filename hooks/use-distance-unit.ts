"use client";

import { useSyncExternalStore } from "react";
import type { DistanceUnit } from "@/lib/distance-format";

const STORAGE_KEY = "distance_unit";
const EVENT = "bondback:distance-unit-changed";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) onStoreChange();
  };
  window.addEventListener(EVENT, onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readUnit(): DistanceUnit {
  if (typeof window === "undefined") return "km";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "mi" ? "mi" : "km";
}

export function useDistanceUnit(): DistanceUnit {
  return useSyncExternalStore(subscribe, readUnit, () => "km");
}

export function setDistanceUnitClient(unit: DistanceUnit): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, unit);
  window.dispatchEvent(new CustomEvent(EVENT));
}
