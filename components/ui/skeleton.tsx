"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Pulse placeholder — tuned for light + dark (gray-950 app shell).
 * Prefer this over ad-hoc divs for consistent perceived performance.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md",
        "bg-muted/80 ring-1 ring-inset ring-border/25 dark:bg-gray-800/90 dark:ring-gray-700/40",
        "motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  );
}
