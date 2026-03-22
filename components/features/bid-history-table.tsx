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
      <p className="text-sm text-muted-foreground">No bids yet.</p>
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
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">Bidder</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
            <th className="px-3 py-2 text-right font-medium">Time</th>
            {onAcceptBid && (
              <th className="w-[100px] px-3 py-2 text-right font-medium">Action</th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((bid) => (
            <tr key={bid.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                {bid.bidder_email ?? `Cleaner ${bid.cleaner_id.slice(0, 8)}…`}
              </td>
              <td className="px-3 py-2 text-right font-medium">
                {formatCents(bid.amount_cents)}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {format(new Date(bid.created_at), "d MMM yyyy, HH:mm")}
              </td>
              {onAcceptBid && (
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="default"
                    className="text-xs"
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
  );
}
