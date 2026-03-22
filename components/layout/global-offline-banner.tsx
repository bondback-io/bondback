"use client";

import { OfflineBanner } from "@/components/offline/offline-banner";
import { useIsOffline } from "@/hooks/use-offline";

/**
 * Site-wide offline strip below the header (cached jobs + last sync when SW has run).
 */
export function GlobalOfflineBanner() {
  const offline = useIsOffline();
  if (!offline) return null;

  return (
    <div className="border-b border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="container mx-auto px-4 py-2">
        <OfflineBanner />
      </div>
    </div>
  );
}
