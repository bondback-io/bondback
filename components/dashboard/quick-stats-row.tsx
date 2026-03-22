"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatItem = {
  label: string;
  value: string | number;
  /** Optional accent color class for value */
  valueClass?: string;
};

export type QuickStatsRowProps = {
  stats: StatItem[];
  className?: string;
  /** On mobile, show as horizontal scroll row instead of 2x2 grid */
  scrollOnMobile?: boolean;
};

export function QuickStatsRow({ stats, className, scrollOnMobile }: QuickStatsRowProps) {
  return (
    <div
      className={cn(
        scrollOnMobile
          ? "flex gap-3 overflow-x-auto pb-1 sm:overflow-visible sm:grid sm:grid-cols-4 sm:gap-4"
          : "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4",
        className
      )}
    >
      {stats.map((stat, i) => (
        <Card
          key={i}
          className={cn(
            "overflow-hidden border-border bg-card shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50",
            scrollOnMobile && "min-w-[140px] shrink-0 sm:min-w-0"
          )}
        >
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground dark:text-gray-500">
              {stat.label}
            </p>
            <p
              className={cn(
                "mt-1 text-xl font-semibold tabular-nums text-foreground dark:text-gray-100 sm:text-2xl",
                stat.valueClass
              )}
            >
              {stat.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
