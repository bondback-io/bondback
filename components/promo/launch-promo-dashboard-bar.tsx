"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { launchPromoCalendarDaysRemaining } from "@/lib/launch-promo";
import type { GlobalSettingsWithLaunchPromo } from "@/lib/launch-promo";

const storageKey = (userId: string) => `bb_launch_promo_dash_bar_v1:${userId}`;

export type LaunchPromoDashboardBarProps = {
  userId: string;
  variant: "lister" | "cleaner";
  used: number;
  freeSlots: number;
  /** ISO end from global_settings; pass null if unset */
  endsAtIso: string | null;
  settings: GlobalSettingsWithLaunchPromo | null;
};

export function LaunchPromoDashboardBar({
  userId,
  variant,
  used,
  freeSlots,
  endsAtIso,
  settings,
}: LaunchPromoDashboardBarProps) {
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

  const now = new Date();
  const daysLeft = launchPromoCalendarDaysRemaining(settings, now);
  const pct = freeSlots > 0 ? Math.min(100, Math.round((used / freeSlots) * 100)) : 0;

  const countdown =
    daysLeft != null ? (
      <span className="shrink-0 font-medium text-emerald-900 dark:text-emerald-200">
        Ends in {daysLeft === 0 ? "<1 day" : `${daysLeft}d`}
      </span>
    ) : (
      <span className="shrink-0 text-emerald-800/90 dark:text-emerald-300/90">No fixed end</span>
    );

  const ctaHref = variant === "lister" ? "/listings/new" : "/find-jobs";
  const ctaLabel = variant === "lister" ? "Create Another Free Job" : "Browse jobs";

  return (
    <div
      className={cn(
        "relative rounded-xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/95 via-white to-emerald-50/80 px-3 py-2.5 shadow-sm",
        "dark:border-emerald-800/70 dark:from-emerald-950/50 dark:via-gray-950 dark:to-emerald-950/35 sm:px-4 sm:py-3"
      )}
      role="region"
      aria-label="Launch promo"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1.5 text-emerald-800/70 transition-colors hover:bg-emerald-100/80 hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-100"
        aria-label="Dismiss promo banner"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col gap-2 pr-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium leading-snug text-emerald-950 dark:text-emerald-50 sm:text-[15px]">
            🎉 Your 0% Fee Promo is Active • {used} of {freeSlots} free jobs used
          </p>
          <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-900/60">
            <div
              className="h-full rounded-full bg-emerald-600 transition-[width] dark:bg-emerald-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-900/85 dark:text-emerald-200/85 sm:text-sm">
            {countdown}
            {endsAtIso ? (
              <span className="hidden text-emerald-800/70 dark:text-emerald-400/80 sm:inline">
                Window ends {new Date(endsAtIso).toLocaleDateString("en-AU", { dateStyle: "medium" })}
              </span>
            ) : null}
          </div>
        </div>
        <Button
          asChild
          size="sm"
          className="h-10 shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:h-9"
        >
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
