"use client";

import { useEffect, useState } from "react";
import { getLastSync } from "@/lib/offline-jobs-cache";
import { WifiOff } from "lucide-react";

function formatTimeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

export type OfflineBannerProps = {
  className?: string;
};

/**
 * Shows when the user is offline: "Offline Mode – Showing cached data. Last updated [time ago]."
 * Reads last sync from IndexedDB (updated when /api/jobs or /api/jobs/[id] is cached by the service worker).
 */
export function OfflineBanner({ className }: OfflineBannerProps) {
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const update = () => {
      setIsOffline(!navigator.onLine);
      if (!navigator.onLine) {
        getLastSync().then(setLastSync);
      }
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={className}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
        <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>
          Offline mode – showing cached data.
          {lastSync != null ? (
            <span className="ml-1 text-amber-800 dark:text-amber-200">
              Last updated {formatTimeAgo(lastSync)}.
            </span>
          ) : (
            <span className="ml-1 text-amber-700 dark:text-amber-300">
              Reconnect to refresh.
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
