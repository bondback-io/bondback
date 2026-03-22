"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-200",
        variant === "default"
          ? "bg-muted text-foreground dark:bg-gray-800 dark:text-gray-100"
          : "border border-border text-muted-foreground dark:border-gray-700 dark:text-gray-400",
        className
      )}
      {...props}
    />
  );
}

