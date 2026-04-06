"use client";

import { memo } from "react";
import type { DashboardListingCardProps } from "@/components/dashboard/dashboard-listing-card";
import { DashboardListingCardWithSwipe } from "@/components/dashboard/dashboard-cards-swipe";

/** Lister: stacked live listing cards on small screens; grid from md up. */
function ResponsiveListerListingCardsInner({
  items,
}: {
  items: DashboardListingCardProps[];
}) {
  if (items.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-4 md:hidden">
        {items.map((props) => (
          <div
            key={String((props.listing as { id: string }).id)}
            className="[&_.text-sm]:text-base [&_.text-xs]:text-sm [&_h3]:text-lg [&_h3]:font-bold [&_button]:min-h-11 [&_button]:px-5 [&_button]:text-sm"
          >
            <DashboardListingCardWithSwipe {...props} />
          </div>
        ))}
      </div>

      <div className="hidden gap-6 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-8">
        {items.map((props) => (
          <div
            key={String((props.listing as { id: string }).id)}
            className="[&_.text-sm]:text-[15px] [&_h3]:text-base"
          >
            <DashboardListingCardWithSwipe {...props} />
          </div>
        ))}
      </div>
    </>
  );
}

export const ResponsiveListerListingCards = memo(ResponsiveListerListingCardsInner);
ResponsiveListerListingCards.displayName = "ResponsiveListerListingCards";
