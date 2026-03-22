"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Gift, X } from "lucide-react";

const DISMISS_KEY = "bondback_first_job_nudge_dismissed";

export type FirstJobRewardsNudgeProps = {
  visible: boolean;
};

/**
 * Encourages new cleaners to complete a paid job so referral rewards can unlock.
 */
export function FirstJobRewardsNudge({ visible }: FirstJobRewardsNudgeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      // ignore
    }
  }, []);

  if (!visible || !mounted || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm dark:border-sky-800 dark:bg-sky-950/40"
    >
      <div className="flex min-w-0 flex-1 gap-2">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
        <div>
          <p className="font-medium text-foreground dark:text-gray-100">
            Complete your first job to unlock rewards
          </p>
          <p className="mt-0.5 text-muted-foreground dark:text-gray-400">
            Finish a bond clean you won, get paid through Bond Back, and you&apos;ll qualify for referral credits and
            other perks.
          </p>
          <Button asChild size="sm" className="mt-2" variant="secondary">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-sky-100 hover:text-foreground dark:hover:bg-sky-900/60 dark:hover:text-gray-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
