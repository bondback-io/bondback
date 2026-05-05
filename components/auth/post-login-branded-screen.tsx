"use client";

import { Loader2 } from "lucide-react";
import { BondBackWordmark } from "@/components/brand/bondback-wordmark";

type PostLoginBrandedScreenProps = {
  /** Shown under the logo; keep short for mobile. */
  statusLine?: string;
};

/**
 * Full-screen, calm loading surface after auth — avoids flashing the login card
 * while cookies and navigation settle.
 */
export function PostLoginBrandedScreen({
  statusLine = "Preparing your workspace…",
}: PostLoginBrandedScreenProps) {
  return (
    <div
      className="fixed inset-0 z-[400] flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-muted/30 dark:from-primary/10 dark:to-gray-950/80"
        aria-hidden
      />
      <div className="relative flex w-full max-w-md flex-col items-center text-center">
        <BondBackWordmark
          variant="labeled"
          className="h-11 max-h-[3rem] max-w-[min(18rem,88vw)] sm:h-12 sm:max-h-[3.25rem] md:h-[3.25rem]"
        />
        <div className="mt-10 flex flex-col items-center gap-5">
          <Loader2
            className="h-10 w-10 animate-spin text-primary/90 sm:h-11 sm:w-11"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="max-w-[20rem] text-sm leading-relaxed text-muted-foreground sm:text-base">
            Connecting you to better bond cleans…
          </p>
          <p className="text-xs text-muted-foreground/90 sm:text-sm">{statusLine}</p>
        </div>
      </div>
    </div>
  );
}
