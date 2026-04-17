"use client";

import * as React from "react";
import { Map, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type FindJobsSplitLayoutProps = {
  /** Scrollable listing column */
  list: React.ReactNode;
  /** Optional custom map area (desktop + sheet). Defaults to placeholder. */
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
        <MapPin className="h-10 w-10 text-muted-foreground dark:text-gray-500" aria-hidden />
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
 * Airtasker-style split: list (~40%) + map (~60%) on large screens; on mobile, list first with map
 * in a bottom sheet.
 */
export function FindJobsSplitLayout({
  list,
  mapPlaceholder,
  className,
}: FindJobsSplitLayoutProps) {
  const [mapOpen, setMapOpen] = React.useState(false);
  const map = mapPlaceholder ?? <DefaultMapPlaceholder />;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-0 lg:flex-row lg:items-stretch",
          "lg:max-h-[min(720px,calc(100dvh-10rem))] lg:min-h-[min(560px,calc(100dvh-11rem))]"
        )}
      >
        <aside
          className={cn(
            "flex min-h-0 w-full min-w-0 flex-col lg:w-[min(420px,36%)] lg:max-w-[440px] lg:shrink-0",
            "border-border lg:border-r lg:border-border/80 dark:lg:border-gray-800"
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-0 pb-28 pt-0 sm:pb-8 lg:px-0 lg:pb-6 lg:pt-0">
            {list}
          </div>
        </aside>

        <section
          className="relative hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-muted/20 shadow-sm dark:border-gray-800 dark:bg-gray-950/40 lg:flex"
          aria-label="Map"
        >
          <div className="min-h-0 flex-1 overflow-hidden">{map}</div>
        </section>
      </div>

      <div className="lg:hidden">
        <Sheet open={mapOpen} onOpenChange={setMapOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              size="lg"
              className={cn(
                "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40",
                "gap-2 rounded-full px-5 shadow-lg",
                "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              )}
              aria-label="Open map"
            >
              <Map className="h-5 w-5 shrink-0" aria-hidden />
              Map
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="flex h-[88dvh] max-h-[88dvh] flex-col gap-0 rounded-t-2xl p-0"
          >
            <SheetTitle className="sr-only">Map</SheetTitle>
            <div className="min-h-0 flex-1 overflow-hidden">{map}</div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
