"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ProgressRingProps = {
  /** 0–100 */
  value: number;
  className?: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
};

/**
 * Circular progress indicator (SVG stroke). Complements shadcn `Progress` (linear bar).
 */
export function ProgressRing({
  value,
  className,
  size = 72,
  strokeWidth = 6,
  label,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `Progress ${Math.round(clamped)} percent`}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-muted dark:stroke-gray-700"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-out dark:stroke-blue-400"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      {label != null && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
