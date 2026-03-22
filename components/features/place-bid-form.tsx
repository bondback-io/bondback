"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { placeBid } from "@/lib/actions/bids";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/lib/listings";
import type { ListingRow } from "@/lib/listings";
import { parseUtcTimestamp } from "@/lib/utils";
import { ConnectRequiredModal } from "@/components/features/connect-required-modal";
import {
  addPendingBid,
  notifyPendingBidsChanged,
  registerSyncPendingBids,
} from "@/lib/offline-bids-db";
import { useToast } from "@/components/ui/use-toast";

export type PlaceBidFormProps = {
  listingId: string;
  listing: ListingRow;
  isCleaner: boolean;
  currentUserId?: string | null;
};

const CONNECT_ERROR_MARKER = "connect your bank account";

export function PlaceBidForm({
  listingId,
  listing,
  isCleaner,
  currentUserId = null,
}: PlaceBidFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [amountDollars, setAmountDollars] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const isLive = listing.status === "live" && parseUtcTimestamp(listing.end_time) > Date.now();
  const currentLowest = listing.current_lowest_bid_cents;
  const minBidDollars = (currentLowest - 1) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = Math.round(parseFloat(amountDollars) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount in dollars.");
      return;
    }
    if (amount >= currentLowest) {
      setError(`Bid must be lower than ${formatCents(currentLowest)}.`);
      return;
    }

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (isOffline) {
      setIsSubmitting(true);
      try {
        await addPendingBid({ jobId: listingId, amount });
        notifyPendingBidsChanged();
        registerSyncPendingBids();
        toast({
          title: "Bid queued",
          description: "Will send when online",
        });
        setAmountDollars("");
      } catch (err) {
        toast({
          title: "Could not queue bid",
          description: "Try again when back online.",
          variant: "destructive",
        });
      }
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    const result = await placeBid(listingId, amount);
    setIsSubmitting(false);
    if (result.ok) {
      setAmountDollars("");
      toast({
        title: "Bid sent",
        description: "Your bid was placed successfully.",
      });
      router.refresh();
    } else {
      const errMsg = result.error ?? "";
      if (errMsg.toLowerCase().includes(CONNECT_ERROR_MARKER) && currentUserId) {
        setConnectModalOpen(true);
      } else {
        setError(errMsg);
      }
    }
  };

  if (!isLive) {
    return (
      <p className="text-sm text-muted-foreground">
        This auction has ended.
      </p>
    );
  }

  if (!isCleaner) {
    return (
      <p className="text-sm text-muted-foreground">
        {currentUserId ? (
          <>
            Switch to <strong>Cleaner</strong> mode in the header or Settings to place a bid.
          </>
        ) : (
          <>
            <Link href="/login" className="font-medium text-primary underline underline-offset-2">
              Log in
            </Link>
            , then switch to Cleaner mode to place a bid.
          </>
        )}
      </p>
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[120px] space-y-1">
          <Label htmlFor="bid-amount">Your bid (AUD)</Label>
          <Input
            id="bid-amount"
            type="number"
            step="1"
            min={1}
            max={minBidDollars}
            placeholder={`Max ${minBidDollars}`}
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Placing…" : "Place lower bid"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Must be lower than current lowest: {formatCents(currentLowest)}.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
    {currentUserId && (
      <ConnectRequiredModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        userId={currentUserId}
        startOnboarding={true}
      />
    )}
    </>
  );
}
