"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { List, Briefcase } from "lucide-react";

/** Icon names that can be passed from Server Components (plain strings). */
export type EmptyStateIconName = "list" | "briefcase";

const EMPTY_STATE_ICON_MAP = {
  list: List,
  briefcase: Briefcase,
} as const;

export type DashboardEmptyStateProps = {
  title: string;
  description?: string;
  actionLabel: string;
  actionHref: string;
  /** Icon identifier (string) so Server Components can pass safely. */
  icon?: EmptyStateIconName;
  className?: string;
};

export function DashboardEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon: iconName,
  className,
}: DashboardEmptyStateProps) {
  const Icon = iconName ? EMPTY_STATE_ICON_MAP[iconName] : null;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 px-4 text-center dark:border-gray-700 dark:bg-gray-900/40",
        className
      )}
    >
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-gray-800 dark:text-gray-400">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground dark:text-gray-100">
        {title}
      </h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground dark:text-gray-400">
          {description}
        </p>
      )}
      <Button asChild size="sm" className="mt-4 rounded-full">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
