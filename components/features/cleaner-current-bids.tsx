"use client";

import { CountdownTimer } from "@/components/features/countdown-timer";
import { Button } from "@/components/ui/button";
import { cancelLastBid } from "@/lib/actions/bids";
import { formatCents } from "@/lib/listings";
import type { Database } from "@/types/supabase";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type BidRow = Database["public"]["Tables"]["bids"]["Row"];

export type CleanerBidItem = {
  bid: BidRow;
  listing: ListingRow;
  isWinning: boolean;
};

export type CleanerCurrentBidsProps = {
  items: CleanerBidItem[];
};

export function CleanerCurrentBids({ items }: CleanerCurrentBidsProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You don&apos;t have any active bids yet. Browse jobs and place a lower
        bid to get started.
      </p>
    );
  }

  const grouped = Object.values(
    items.reduce(
      (acc, item) => {
        const key = item.listing.id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      },
      {} as Record<string, CleanerBidItem[]>
    )
  ).map((itemsForListing) => {
    const sorted = [...itemsForListing].sort((a, b) =>
      a.bid.created_at < b.bid.created_at ? 1 : -1
    );
    const [latest, ...others] = sorted;
    return { latest, others };
  });

  return (
    <div className="divide-y rounded-md border">
      {grouped.map(({ latest, others }) => {
        const { bid, listing, isWinning } = latest;
        const listingCancelled =
          String(listing.status).toLowerCase() === "cancelled";
        return (
          <div
            key={listing.id}
            className="flex flex-col gap-1 p-3 text-sm hover:bg-muted/60"
          >
            <a
              href={`/jobs/${listing.id}`}
              className="flex flex-col gap-1"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{listing.title}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] font-medium ${
                      isWinning
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {isWinning ? "Winning" : "Outbid"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-[1px] text-[10px] font-medium text-sky-700">
                    {listingCancelled ? "Cancelled" : "Active"}
                  </span>
                  {!listingCancelled && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span>Ends in</span>
                    <CountdownTimer
                      endTime={listing.end_time}
                      className="text-[11px] text-muted-foreground"
                      expiredLabel="Ended"
                    />
                  </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Location: {listing.suburb} {listing.postcode} ·{" "}
                  {listing.bedrooms}b / {listing.bathrooms}b
                </span>
                <span>
                  Your latest bid:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCents(bid.amount_cents)}
                  </span>
                </span>
                <span>
                  Current lowest:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCents(listing.current_lowest_bid_cents)}
                  </span>
                </span>
              </div>
            </a>
            {!listingCancelled && (
            <div className="mt-1 flex justify-end">
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="border-amber-300 text-[11px] text-amber-800 hover:bg-amber-50"
                onClick={async () => {
                  const confirmed = window.confirm(
                    "Cancel your last bid on this listing? This cannot be undone."
                  );
                  if (!confirmed) return;
                  const res = await cancelLastBid(listing.id);
                  if (!res.ok) {
                    alert(res.error);
                  }
                }}
              >
                Cancel last bid
              </Button>
            </div>
            )}
            {others.length > 0 && (
              <details className="mt-1 text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">
                  View {others.length} earlier bid
                  {others.length > 1 ? "s" : ""}
                </summary>
                <ul className="mt-1 space-y-1 pl-4">
                  {others.map(({ bid: b }) => (
                    <li key={b.id}>
                      {new Date(b.created_at).toLocaleString()} —{" "}
                      {formatCents(b.amount_cents)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

