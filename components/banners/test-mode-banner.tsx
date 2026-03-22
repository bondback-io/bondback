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
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-600/50 px-3 py-2 text-sm text-gray-900 shadow-md md:px-4"
        style={{ backgroundColor: "#f59e0b" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <span className="shrink-0 font-semibold uppercase tracking-wide">
            Test mode active
          </span>
          <span className="hidden text-gray-900/90 sm:inline">
            — No real money is processed. All Stripe operations are simulated.
          </span>
          <span className="text-gray-900/90 sm:hidden">
            No real charges. Stripe simulated.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="h-8 border-gray-800/30 bg-gray-900/10 text-gray-900 hover:bg-gray-900/20"
          >
            <Link href="/admin/global-settings">Go to Global Settings</Link>
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-900/80 hover:bg-gray-900/15 hover:text-gray-900"
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
