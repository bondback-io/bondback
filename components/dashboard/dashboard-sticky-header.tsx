"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DashboardStickyHeaderProps = {
  title: string;
  roleLabel: string;
  role: "lister" | "cleaner";
};

export function DashboardStickyHeader({
  title,
  roleLabel,
  role,
}: DashboardStickyHeaderProps) {
  const badgeClass =
    role === "lister"
      ? "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200";

  return (
    <header className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:border-gray-800 dark:bg-gray-950/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground dark:text-gray-100 sm:text-xl">
          {title}
        </h1>
        <Badge className={cn("shrink-0 text-xs font-medium", badgeClass)}>
          {roleLabel}
        </Badge>
      </div>
    </header>
  );
}
