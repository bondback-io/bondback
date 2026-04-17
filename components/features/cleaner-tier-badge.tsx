"use client";

import {
  CLEANER_TIER_META,
  CLEANER_TIER_ORDER,
  type CleanerBrowseTier,
} from "@/lib/cleaner-browse-tier";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type CleanerTierBadgeProps = {
  tier: CleanerBrowseTier;
  /** browse legend row vs compact card chip */
  variant?: "card" | "legend";
  className?: string;
};

function CleanerTierBadgeInner({
  tier,
  variant = "card",
  className,
}: CleanerTierBadgeProps) {
  const m = CLEANER_TIER_META[tier];
  const legend = variant === "legend";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex max-w-full cursor-default items-center justify-center rounded-full border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            legend
              ? "min-h-[2.25rem] w-full px-2.5 py-1.5 text-[11px] font-medium sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs"
              : "px-2 py-0.5 text-[10px] font-medium sm:text-[11px]",
            m.className,
            className
          )}
        >
          <span className="truncate">{m.chipLabel}</span>
          <span className="sr-only">{`: ${m.label}. Tap or hover for details.`}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[min(92vw,20rem)] space-y-1.5 border-border/80 p-3 text-left text-xs leading-snug"
      >
        <p className="font-semibold text-popover-foreground">{m.label}</p>
        <p className="text-[11px] text-muted-foreground dark:text-gray-400">{m.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function CleanerTierBadge(props: CleanerTierBadgeProps) {
  const legend = props.variant === "legend";
  return (
    <TooltipProvider delayDuration={legend ? 150 : 250}>
      <CleanerTierBadgeInner {...props} />
    </TooltipProvider>
  );
}

/** Browse `/cleaners` — four compact level chips; details on hover / long-press */
export function CleanerBrowseTierLegend() {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2">
        {CLEANER_TIER_ORDER.map((key) => (
          <CleanerTierBadgeInner key={key} tier={key} variant="legend" />
        ))}
      </div>
    </TooltipProvider>
  );
}
