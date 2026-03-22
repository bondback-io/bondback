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
  /**
   * @deprecated No longer uses horizontal scroll — stats always use a 2×2 grid on small screens.
   * Kept for API compatibility with existing call sites.
   */
  scrollOnMobile?: boolean;
};

export function QuickStatsRow({ stats, className }: QuickStatsRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4",
        className
      )}
    >
      {stats.map((stat, i) => (
        <Card
          key={i}
          className="overflow-hidden border-border bg-card shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50"
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
