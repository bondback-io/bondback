"use client";

import * as React from "react";
import { List, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FindJobsSplitLayoutProps = {
  /** Scrollable listing column */
  list: React.ReactNode;
  /** Optional custom map area (desktop + mobile map tab). Defaults to placeholder. */
  mapPlaceholder?: React.ReactNode;
  className?: string;
};

function DefaultMapPlaceholder() {
  return (
    <div
      className={cn(
        "flex h-full min-h-[320px] flex-col items-center justify-center gap-4 bg-muted/40 p-8 text-center",
        "dark:bg-gray-900/60"
      )}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border dark:bg-gray-950 dark:ring-gray-800">
        <Map className="h-10 w-10 text-muted-foreground dark:text-gray-500" aria-hidden />
      </div>
      <div className="max-w-sm space-y-2">
        <p className="text-lg font-semibold text-foreground dark:text-gray-100">Map view</p>
        <p className="text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
          An interactive map of jobs near you will appear here. Browse listings on the left and open
          a job for full details.
        </p>
      </div>
    </div>
  );
}

/**
 * Airtasker-style split: list (~40%) + map (~60%) on large screens; on mobile, list-first with a
 * List / Map toggle — map is full-height with job list in the left column as a bottom sheet (same
 * scroll surface, repositioned when Map is active).
 */
export function FindJobsSplitLayout({
  list,
  mapPlaceholder,
  className,
}: FindJobsSplitLayoutProps) {
  const [mobileTab, setMobileTab] = React.useState<"list" | "map">("list");
  const map = mapPlaceholder ?? <DefaultMapPlaceholder />;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col gap-0 lg:flex-row lg:items-stretch",
          "lg:max-h-[min(720px,calc(100dvh-10rem))] lg:min-h-[min(560px,calc(100dvh-11rem))]"
        )}
      >
        <div
          role="tablist"
          aria-label="Browse mode"
          className="flex shrink-0 gap-1 border-b border-border bg-muted/30 p-1 dark:border-gray-800 dark:bg-gray-950/50 lg:hidden"
        >
          <Button
            type="button"
            role="tab"
            aria-selected={mobileTab === "list"}
            variant={mobileTab === "list" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-10 flex-1 gap-2 rounded-lg text-sm font-semibold",
              mobileTab === "list" && "bg-background shadow-sm dark:bg-gray-900"
            )}
            onClick={() => setMobileTab("list")}
          >
            <List className="h-4 w-4 shrink-0" aria-hidden />
            List
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={mobileTab === "map"}
            variant={mobileTab === "map" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-10 flex-1 gap-2 rounded-lg text-sm font-semibold",
              mobileTab === "map" && "bg-background shadow-sm dark:bg-gray-900"
            )}
            onClick={() => setMobileTab("map")}
          >
            <Map className="h-4 w-4 shrink-0" aria-hidden />
            Map
          </Button>
        </div>

        <aside
          className={cn(
            "flex min-h-0 w-full min-w-0 flex-col lg:w-[min(420px,36%)] lg:max-w-[440px] lg:shrink-0",
            "border-border lg:border-r lg:border-border/80 dark:lg:border-gray-800",
            mobileTab === "map" &&
              "fixed inset-x-0 bottom-0 z-40 max-h-[min(46vh,380px)] rounded-t-2xl border-t border-border bg-background shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:border-gray-800 dark:bg-gray-950 lg:relative lg:inset-auto lg:z-0 lg:max-h-none lg:rounded-none lg:border-t-0 lg:shadow-none"
          )}
        >
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-0 pb-28 pt-0 sm:pb-8 lg:px-0 lg:pb-6 lg:pt-0",
              mobileTab === "map" && "pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            )}
          >
            {list}
          </div>
        </aside>

        <section
          className={cn(
            "relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-muted/20 shadow-sm dark:border-gray-800 dark:bg-gray-950/40",
            "hidden lg:flex",
            mobileTab === "map" && "!flex min-h-[min(100dvh,760px)] flex-1 lg:min-h-0"
          )}
          aria-label="Map"
        >
          <div className="min-h-0 flex-1 overflow-hidden">{map}</div>
        </section>
      </div>
    </div>
  );
}
