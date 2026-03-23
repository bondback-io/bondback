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
import { cn, parseUtcTimestamp } from "@/lib/utils";
import { ConnectRequiredModal } from "@/components/features/connect-required-modal";
import {
  addPendingBid,
  notifyPendingBidsChanged,
  registerSyncPendingBids,
} from "@/lib/offline-bids-db";
import { useToast } from "@/components/ui/use-toast";
import { Gavel, TrendingDown } from "lucide-react";

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
  /** Highest allowed bid in dollars (1¢ below current lowest — reverse auction). */
  const maxAllowedBidDollars = Math.max(0, (currentLowest - 1) / 100);

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
      <div className="rounded-2xl border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
        This auction has ended — bidding is closed.
      </div>
    );
  }

  if (!isCleaner) {
    return (
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-4 text-sm leading-relaxed text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        {currentUserId ? (
          <>
            Switch to <strong>Cleaner</strong> mode in the header or Settings to place a bid on this job.
          </>
        ) : (
          <>
            <Link href="/login" className="font-medium text-primary underline underline-offset-2">
              Log in
            </Link>
            , then switch to Cleaner mode to place a bid.
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-muted/50 to-background dark:border-gray-800 dark:from-gray-900/80 dark:to-gray-950"
          )}
        >
          <div className="flex items-start gap-3 border-b border-border/80 px-4 py-3.5 dark:border-gray-800">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/15">
              <TrendingDown className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                Current lowest bid
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground dark:text-gray-100">
                {formatCents(currentLowest)}
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground dark:text-gray-500">
                Your new bid must be{" "}
                <span className="font-medium text-foreground dark:text-gray-300">lower</span> than this
                {maxAllowedBidDollars > 0 ? (
                  <>
                    {" "}
                    (max you can enter:{" "}
                    <span className="tabular-nums font-medium text-foreground dark:text-gray-200">
                      ${maxAllowedBidDollars.toFixed(2)}
                    </span>
                    )
                  </>
                ) : null}
                .
              </p>
            </div>
          </div>

          <div className="space-y-3 px-4 py-4">
            <Label
              htmlFor="bid-amount"
              className="text-sm font-medium text-foreground dark:text-gray-100"
            >
              Your bid amount
            </Label>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-base font-semibold text-muted-foreground dark:text-gray-400"
                aria-hidden
              >
                $
              </span>
              <Input
                id="bid-amount"
                name="bid-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0.01}
                max={maxAllowedBidDollars > 0 ? maxAllowedBidDollars : undefined}
                placeholder={maxAllowedBidDollars > 0 ? maxAllowedBidDollars.toFixed(2) : "0.00"}
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                className={cn(
                  "h-12 min-h-[48px] border-2 pl-8 text-lg font-semibold tabular-nums",
                  "focus-visible:ring-2 focus-visible:ring-primary/30",
                  "dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-100"
                )}
                autoComplete="off"
                aria-describedby="bid-amount-hint"
              />
            </div>
            <p id="bid-amount-hint" className="text-[11px] leading-relaxed text-muted-foreground dark:text-gray-500">
              Enter dollars and cents. We&apos;ll validate against the live lowest bid when you submit.
            </p>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 min-h-[48px] w-full gap-2 text-base font-semibold shadow-sm sm:max-w-md"
              size="lg"
            >
              <Gavel className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {isSubmitting ? "Placing bid…" : "Place lower bid"}
            </Button>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
          >
            {error}
          </div>
        ) : null}
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
