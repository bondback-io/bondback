"use client";

import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type FormSavingOverlayProps = {
  show: boolean;
  title: string;
  description?: string;
  /** `card` = absolute over a positioned parent; `screen` = fixed full viewport (better on small phones). */
  variant?: "card" | "screen";
  className?: string;
};

/**
 * Non-blocking visual feedback for async form saves (use with `useTransition` + explicit saving state).
 */
export function FormSavingOverlay({
  show,
  title,
  description,
  variant = "card",
  className,
}: FormSavingOverlayProps) {
  if (!show) return null;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 bg-background/90 p-4 backdrop-blur-sm dark:bg-gray-950/92",
        variant === "screen"
          ? "fixed inset-0 z-[200] pb-[max(1rem,env(safe-area-inset-bottom))]"
          : "absolute inset-0 z-20 rounded-[inherit]",
        className
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 shrink-0 animate-spin text-primary" aria-hidden />
      <p className="text-center text-sm font-semibold text-foreground dark:text-gray-100">{title}</p>
      {description ? (
        <p className="max-w-xs text-center text-xs leading-snug text-muted-foreground dark:text-gray-400">
          {description}
        </p>
      ) : null}
      <div className="mt-1 w-full max-w-[min(100%,18rem)] space-y-2">
        <Skeleton className="h-2.5 w-full rounded-md" />
        <Skeleton className="h-2.5 w-[88%] rounded-md" />
        <Skeleton className="h-2.5 w-[72%] rounded-md sm:w-[65%]" />
      </div>
    </div>
  );
}
