"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "bondback-test-mode-banner-dismissed";

type TestModeBannerProps = {
  /** When false, banner is not rendered. */
  stripeTestMode: boolean;
};

export function TestModeBanner({ stripeTestMode }: TestModeBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!stripeTestMode) return;
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, [stripeTestMode]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
      setDismissed(true);
    } catch {
      setDismissed(true);
    }
  };

  if (!stripeTestMode || dismissed) return null;

  return (
    <>
      <div
        role="banner"
        aria-label="Stripe test mode active"
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-600/50 bg-amber-400 px-3 py-2 text-sm text-amber-950 shadow-md dark:border-amber-500/40 dark:bg-amber-900/95 dark:text-amber-50 md:px-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <span className="shrink-0 font-semibold uppercase tracking-wide">
            Test mode active
          </span>
          <span className="hidden text-amber-950/90 dark:text-amber-100/95 sm:inline">
            — No real money is processed. All Stripe operations are simulated.
          </span>
          <span className="text-amber-950/90 dark:text-amber-100/95 sm:hidden">
            No real charges. Stripe simulated.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="h-8 border-amber-950/25 bg-amber-950/10 text-amber-950 hover:bg-amber-950/20 dark:border-amber-200/30 dark:bg-amber-100/15 dark:text-amber-50 dark:hover:bg-amber-100/25"
          >
            <Link href="/admin/global-settings">Go to Global Settings</Link>
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-amber-950/85 hover:bg-amber-950/15 hover:text-amber-950 dark:text-amber-100/90 dark:hover:bg-amber-100/15 dark:hover:text-amber-50"
            aria-label="Dismiss test mode banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Spacer so content is not under the fixed banner */}
      <div className="h-12 shrink-0" aria-hidden />
    </>
  );
}
