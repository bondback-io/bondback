"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { Database } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "@/components/features/countdown-timer";
import { formatCents } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { setActiveRole } from "@/lib/actions/profile";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

export type FeaturedJobsCarouselProps = {
  listings: ListingRow[];
  viewerIsCleaner: boolean;
  canSwitchToCleaner: boolean;
};

export function FeaturedJobsCarousel({
  listings,
  viewerIsCleaner,
  canSwitchToCleaner,
}: FeaturedJobsCarouselProps) {
  const [index, setIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const items = useMemo(
    () =>
      (listings ?? []).filter(
        (l) => l.status === "live" && typeof l.end_time === "string"
      ),
    [listings]
  );

  if (!items.length) {
    return null;
  }

  const current = items[Math.min(index, items.length - 1)];

  const goPrev = () =>
    setIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
  const goNext = () =>
    setIndex((i) => (i >= items.length - 1 ? 0 : i + 1));

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(goNext, 3000);
    return () => clearInterval(id);
  }, [items.length]);

  const handleViewClick = () => {
    const jobUrl = `/jobs/${current.id}`;

    if (viewerIsCleaner) {
      router.push(jobUrl);
      return;
    }

    if (canSwitchToCleaner) {
      startTransition(async () => {
        await setActiveRole("cleaner");
        router.push(jobUrl);
        router.refresh();
      });
      return;
    }

    const loginUrl = `/login?role=cleaner&next=${encodeURIComponent(jobUrl)}`;
    router.push(loginUrl);
  };

  return (
    <section className="page-inner space-y-5 pb-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">
            Live bond cleans ending soon
          </h2>
          <p className="text-xs text-muted-foreground md:text-sm">
            Cleaners can tap a job to see full details and place a lower bid. Listers can preview
            how their listing will look in the marketplace.
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {index + 1} of {items.length}
        </p>
      </div>
      <div className="relative">
        <Card
          key={current.id}
          className="overflow-hidden border-border/70 bg-card/80 shadow-md transition-all duration-500 ease-out hover:shadow-lg animate-in fade-in-0 slide-in-from-right-2"
        >
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
            <div className="flex-1 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {formatLocationWithState(current.suburb, current.postcode)} · ends in{" "}
                <CountdownTimer
                  endTime={current.end_time as string}
                  className="font-semibold text-foreground"
                  expiredLabel="Ended"
                />
              </p>
              <h3 className="line-clamp-2 text-base font-semibold sm:text-lg">
                {current.title}
              </h3>
              <p className="text-xs text-muted-foreground">
                {current.bedrooms} bed · {current.bathrooms} bath ·{" "}
                {current.property_type ?? "Bond clean"}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <div className="rounded-md bg-muted px-3 py-1">
                  Reserve:{" "}
                  <span className="font-semibold">
                    {formatCents(
                      (current.reserve_cents as number | null) ?? 0
                    )}
                  </span>
                </div>
                <div className="rounded-md bg-emerald-50 px-3 py-1 text-emerald-800">
                  Current lowest:{" "}
                  <span className="font-semibold">
                    {formatCents(
                      (current.current_lowest_bid_cents as number | null) ??
                        (current.base_price_cents as number | null) ??
                        0
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col items-end justify-between gap-3 sm:w-48">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goPrev}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-xs shadow-sm hover:bg-muted"
                  aria-label="Previous job"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-xs shadow-sm hover:bg-muted"
                  aria-label="Next job"
                >
                  ›
                </button>
              </div>
              <Button
                size="sm"
                className="w-full text-xs sm:text-sm"
                onClick={handleViewClick}
                disabled={isPending}
              >
                View job &amp; bid
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

