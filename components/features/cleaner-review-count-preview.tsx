"use client";

import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type CleanerReviewSnippet = {
  id: string;
  text: string;
};

type CleanerReviewCountPreviewProps = {
  count: number;
  snippets: CleanerReviewSnippet[];
  className?: string;
};

const CLOSE_DELAY_MS = 200;

/**
 * Inline “N reviews” with popover showing the last few written feedback snippets (hover + click).
 */
export function CleanerReviewCountPreview({
  count,
  snippets,
  className,
}: CleanerReviewCountPreviewProps) {
  const [open, setOpen] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScheduledClose = React.useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = React.useCallback(() => {
    clearScheduledClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [clearScheduledClose]);

  const keepOpen = React.useCallback(() => {
    clearScheduledClose();
    setOpen(true);
  }, [clearScheduledClose]);

  const label = `${count} review${count === 1 ? "" : "s"}`;

  if (snippets.length === 0) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <span
        className={cn("inline-flex", className)}
        onMouseEnter={keepOpen}
        onMouseLeave={scheduleClose}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline cursor-pointer border-b border-dotted border-current text-inherit underline-offset-2",
              "transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
            aria-expanded={open}
            aria-label={`${label}, show recent written feedback`}
          >
            {label}
          </button>
        </PopoverTrigger>
      </span>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="max-w-sm space-y-3 p-4 text-sm shadow-xl dark:bg-gray-900 dark:border-gray-800"
        onMouseEnter={keepOpen}
        onMouseLeave={scheduleClose}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
          Recent feedback
        </p>
        <ul className="space-y-3">
          {snippets.map((s) => (
            <li key={s.id}>
              <blockquote className="border-l-2 border-emerald-500/60 pl-3 text-[13px] leading-relaxed text-foreground dark:text-gray-100">
                <span className="text-muted-foreground">&ldquo;</span>
                {s.text}
                <span className="text-muted-foreground">&rdquo;</span>
              </blockquote>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
