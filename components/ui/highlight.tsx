"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Renders text with matching search term highlighted (bold + yellow background).
 * Safe for user-provided search terms: escapes regex special chars.
 */
export function Highlight({
  text,
  term,
  className,
  markClassName,
}: {
  text: string;
  term: string;
  className?: string;
  markClassName?: string;
}) {
  if (!term.trim()) {
    return <span className={className}>{text}</span>;
  }
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className={cn(
              "font-semibold bg-yellow-200 text-yellow-900 dark:bg-yellow-500/40 dark:text-yellow-100 rounded px-0.5",
              markClassName
            )}
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}

const MARK_CLASS =
  "font-semibold bg-yellow-200 text-yellow-900 dark:bg-yellow-500/40 dark:text-yellow-100 rounded px-0.5";

/**
 * Renders text with Fuse.js match indices highlighted (bold + yellow background).
 * indices: array of [start, end] character ranges (end exclusive).
 */
export function HighlightByIndices({
  text,
  indices,
  className,
  markClassName,
}: {
  text: string;
  indices: readonly [number, number][];
  className?: string;
  markClassName?: string;
}) {
  if (!indices?.length || text === "") {
    return <span className={className}>{text}</span>;
  }

  const sorted = [...indices]
    .filter(([a, b]) => a < b && a >= 0 && b <= text.length)
    .sort(([a], [c]) => a - c);

  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const nodes: React.ReactNode[] = [];
  let pos = 0;
  for (const [start, end] of merged) {
    if (start > pos) {
      nodes.push(<React.Fragment key={`${pos}-${start}`}>{text.slice(pos, start)}</React.Fragment>);
    }
    nodes.push(
      <mark key={`m-${start}`} className={cn(MARK_CLASS, markClassName)}>
        {text.slice(start, end)}
      </mark>
    );
    pos = end;
  }
  if (pos < text.length) {
    nodes.push(<React.Fragment key={`${pos}-tail`}>{text.slice(pos)}</React.Fragment>);
  }

  return <span className={className}>{nodes}</span>;
}
