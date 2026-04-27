"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const storageKey = (userId: string) => `bb_launch_promo_listing_form_v1:${userId}`;

export type LaunchPromoListingFormBannerProps = {
  userId: string;
  used: number;
  freeSlots: number;
};

export function LaunchPromoListingFormBanner({
  userId,
  used,
  freeSlots,
}: LaunchPromoListingFormBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey(userId)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [userId]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey(userId), "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  const remaining = Math.max(0, freeSlots - used);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-3 py-3 shadow-sm ring-1 ring-emerald-500/10",
        "dark:border-emerald-700/60 dark:from-emerald-950/55 dark:to-emerald-950/25 dark:ring-emerald-400/10 sm:px-4 sm:py-3.5"
      )}
      role="status"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1.5 text-emerald-900/60 transition-colors hover:bg-emerald-200/60 hover:text-emerald-950 dark:text-emerald-200/60 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-50"
        aria-label="Dismiss promo notice"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-2 pr-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-emerald-600/30 bg-emerald-600 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-emerald-600">
              Promo active
            </Badge>
          </div>
          <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-50 sm:text-base">
            Great news! This job qualifies for 0% platform fee
          </p>
          <p className="text-xs text-emerald-900/85 dark:text-emerald-200/90 sm:text-sm">
            You have {remaining} of {freeSlots} free jobs remaining
          </p>
        </div>
      </div>
    </div>
  );
}
