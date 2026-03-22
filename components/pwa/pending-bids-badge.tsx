"use client";

import { useEffect, useState } from "react";
import { getPendingCount, onPendingBidsChanged } from "@/lib/offline-bids-db";
import { useToast } from "@/components/ui/use-toast";

export type PendingBidsBadgeProps = {
  isCleaner: boolean;
  className?: string;
};

/**
 * Shows "X bids pending sync" when the user has queued offline bids.
 * Listens for PENDING_BIDS_SYNCED from the service worker and toasts "Bid placed successfully".
 */
export function PendingBidsBadge({ isCleaner, className }: PendingBidsBadgeProps) {
  const [count, setCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!isCleaner) return;

    const refresh = () => {
      getPendingCount().then(setCount);
    };

    refresh();
    const unsub = onPendingBidsChanged(refresh);
    window.addEventListener("online", refresh);

    return () => {
      unsub();
      window.removeEventListener("online", refresh);
    };
  }, [isCleaner]);

  useEffect(() => {
    if (!isCleaner) return;

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "PENDING_BIDS_SYNCED" && typeof data.count === "number" && data.count > 0) {
        toast({
          title: "Bid sent",
          description:
            data.count === 1
              ? "Your bid was placed successfully."
              : `${data.count} bids placed successfully.`,
        });
        getPendingCount().then(setCount);
      }
    };

    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, [isCleaner, toast]);

  if (!isCleaner || count <= 0) return null;

  return (
    <span
      className={className}
      role="status"
      aria-live="polite"
      aria-label={`${count} bid${count === 1 ? "" : "s"} pending sync`}
    >
      <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground dark:bg-gray-800 dark:text-gray-300">
        {count} bid{count === 1 ? "" : "s"} pending
      </span>
    </span>
  );
}
