"use client";

import * as React from "react";
import { format } from "date-fns";
import { Star } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type CleanerReviewSnippet = {
  id: string;
  /** Empty string => show “no written comment” for that review in the popover. */
  text: string;
  author?: string | null;
  createdAt?: string;
  rating?: number;
};

type CleanerReviewCountPreviewProps = {
  count: number;
  snippets: CleanerReviewSnippet[];
  className?: string;
  /** Shown when count exceeds snippets length (e.g. “Showing 4 most recent”). */
  moreCountHint?: string | null;
};

const CLOSE_DELAY_MS = 200;

function MiniStars({ rating }: { rating: number }) {
  const n = Math.min(5, Math.max(0, Math.round(Number(rating)) || 0));
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            "h-3 w-3",
            s <= n
              ? "fill-amber-400 text-amber-400 dark:fill-amber-500 dark:text-amber-500"
              : "text-muted-foreground/35"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Inline “N reviews” with popover (hover + click) showing written feedback, author, date, and stars.
 */
export function CleanerReviewCountPreview({
  count,
  snippets,
  className,
  moreCountHint,
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

  if (count <= 0) {
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
            aria-label={`${label}, show written feedback`}
          >
            {label}
          </button>
        </PopoverTrigger>
      </span>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="max-h-[min(70vh,420px)] max-w-sm space-y-3 overflow-y-auto p-4 text-sm shadow-xl dark:border-gray-800 dark:bg-gray-900"
        onMouseEnter={keepOpen}
        onMouseLeave={scheduleClose}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
          Written feedback
        </p>
        {moreCountHint ? (
          <p className="text-[11px] leading-snug text-muted-foreground dark:text-gray-500">
            {moreCountHint}
          </p>
        ) : null}
        {snippets.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground dark:text-gray-400">
            No written comments are on file for these reviews yet — you may still see star ratings on the
            full profile.
          </p>
        ) : (
          <ul className="space-y-4">
            {snippets.map((s) => (
              <li key={s.id} className="border-b border-border/60 pb-3 last:border-0 last:pb-0 dark:border-gray-800">
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                  <p className="text-xs font-semibold text-foreground dark:text-gray-100">
                    {s.author?.trim() || "Lister"}
                  </p>
                  {s.createdAt ? (
                    <time
                      className="shrink-0 text-[10px] tabular-nums text-muted-foreground dark:text-gray-500"
                      dateTime={s.createdAt}
                    >
                      {(() => {
                        try {
                          return format(new Date(s.createdAt), "d MMM yyyy");
                        } catch {
                          return "";
                        }
                      })()}
                    </time>
                  ) : null}
                </div>
                {typeof s.rating === "number" && !Number.isNaN(s.rating) ? (
                  <div className="mt-1">
                    <MiniStars rating={s.rating} />
                  </div>
                ) : null}
                {s.text.trim() ? (
                  <blockquote className="mt-2 border-l-2 border-emerald-500/60 pl-3 text-[13px] leading-relaxed text-foreground dark:text-gray-100">
                    <span className="text-muted-foreground">&ldquo;</span>
                    {s.text}
                    <span className="text-muted-foreground">&rdquo;</span>
                  </blockquote>
                ) : (
                  <p className="mt-2 text-[12px] italic text-muted-foreground dark:text-gray-500">
                    No written comment for this review.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
