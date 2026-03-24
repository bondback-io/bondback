"use client";

import { useState } from "react";
import { format } from "date-fns";
import { formatCents } from "@/lib/listings";
import type { BidRow } from "@/lib/listings";
import { Button } from "@/components/ui/button";

export type BidWithBidder = BidRow & {
  bidder_email?: string | null;
};

export type BidHistoryTableProps = {
  bids: BidWithBidder[];
  /** When set, show Accept bid button for lister (listing owner, no job yet). */
  onAcceptBid?: (bid: BidWithBidder) => Promise<void>;
};

export function BidHistoryTable({ bids, onAcceptBid }: BidHistoryTableProps) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const sorted = [...bids].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground dark:text-gray-400">No bids yet.</p>
    );
  }

  const handleAccept = async (bid: BidWithBidder) => {
    if (!onAcceptBid) return;
    setAcceptingId(bid.id);
    try {
      await onAcceptBid(bid);
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <>
      {/* Mobile: card layout so Accept bid is full-width and readable */}
      <ul className="space-y-3 md:hidden">
        {sorted.map((bid) => (
          <li
            key={bid.id}
            className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/70"
          >
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                Bidder
              </p>
              <p className="break-words text-sm font-medium text-foreground dark:text-gray-100">
                {bid.bidder_email ?? `Cleaner ${bid.cleaner_id.slice(0, 8)}…`}
              </p>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3 dark:border-gray-700">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                  Amount
                </p>
                <p className="text-lg font-bold tabular-nums text-foreground dark:text-gray-50">
                  {formatCents(bid.amount_cents)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                  Time
                </p>
                <p className="text-xs tabular-nums text-muted-foreground dark:text-gray-400">
                  {format(new Date(bid.created_at), "d MMM yyyy, HH:mm")}
                </p>
              </div>
            </div>
            {onAcceptBid && (
              <Button
                type="button"
                size="lg"
                variant="default"
                className="mt-4 h-12 w-full text-base font-semibold"
                disabled={!!acceptingId}
                onClick={() => handleAccept(bid)}
              >
                {acceptingId === bid.id ? "Accepting…" : "Accept bid"}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-md border border-border dark:border-gray-700 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 dark:border-gray-700 dark:bg-gray-800/90">
              <th className="px-3 py-2 text-left font-medium text-foreground dark:text-gray-200">
                Bidder
              </th>
              <th className="px-3 py-2 text-right font-medium text-foreground dark:text-gray-200">
                Amount
              </th>
              <th className="px-3 py-2 text-right font-medium text-foreground dark:text-gray-200">
                Time
              </th>
              {onAcceptBid && (
                <th className="min-w-[7.5rem] px-3 py-2 text-right font-medium text-foreground dark:text-gray-200">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((bid) => (
              <tr
                key={bid.id}
                className="border-b border-border last:border-0 dark:border-gray-700/80"
              >
                <td className="px-3 py-2 text-foreground dark:text-gray-200">
                  {bid.bidder_email ?? `Cleaner ${bid.cleaner_id.slice(0, 8)}…`}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground dark:text-gray-100">
                  {formatCents(bid.amount_cents)}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground dark:text-gray-400">
                  {format(new Date(bid.created_at), "d MMM yyyy, HH:mm")}
                </td>
                {onAcceptBid && (
                  <td className="px-3 py-2 text-right align-middle">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="text-xs font-semibold"
                      disabled={!!acceptingId}
                      onClick={() => handleAccept(bid)}
                    >
                      {acceptingId === bid.id ? "Accepting…" : "Accept bid"}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
