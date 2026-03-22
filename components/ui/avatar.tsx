"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type AvatarProps = React.HTMLAttributes<HTMLDivElement>;

export function Avatar({ className, children, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground/80",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type AvatarFallbackProps = React.HTMLAttributes<HTMLSpanElement>;

export function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground/80",
        className
      )}
      {...props}
    />
  );
}

