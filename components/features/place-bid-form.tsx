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
import { MAX_BID_DROP_PER_BID_CENTS } from "@/lib/bidding-rules";
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
  /** Lowest allowed bid: at most $100 below current lowest in one step. */
  const minAllowedBidCents = Math.max(1, currentLowest - MAX_BID_DROP_PER_BID_CENTS);
  const minAllowedBidDollars = minAllowedBidCents / 100;

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
    if (amount < minAllowedBidCents) {
      setError(
        `Each bid can lower the price by at most $${(MAX_BID_DROP_PER_BID_CENTS / 100).toFixed(0)} in one step. Enter between ${formatCents(minAllowedBidCents)} and ${formatCents(currentLowest - 1)}.`
      );
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
            "overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-muted/50 to-background dark:border-gray-800 dark:from-gray-900/80 dark:to-gray-950",
            isCleaner &&
              "border-emerald-500/30 ring-1 ring-emerald-500/10 dark:border-emerald-900/50 dark:ring-emerald-900/20"
          )}
        >
          <div className="flex items-start gap-3 border-b border-border/80 px-4 py-4 dark:border-gray-800 sm:px-5 sm:py-4">
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/15",
                isCleaner ? "h-12 w-12" : "h-10 w-10"
              )}
            >
              <TrendingDown className={cn(isCleaner ? "h-6 w-6" : "h-5 w-5")} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400",
                  isCleaner ? "text-xs" : "text-[11px]"
                )}
              >
                Current lowest bid
              </p>
              <p
                className={cn(
                  "mt-0.5 font-bold tabular-nums tracking-tight text-foreground dark:text-gray-100",
                  isCleaner ? "text-3xl sm:text-4xl" : "text-2xl"
                )}
              >
                {formatCents(currentLowest)}
              </p>
              <p
                className={cn(
                  "mt-1 leading-snug text-muted-foreground dark:text-gray-500",
                  isCleaner ? "text-sm" : "text-xs"
                )}
              >
                Your new bid must be{" "}
                <span className="font-medium text-foreground dark:text-gray-300">lower</span> than this
                {maxAllowedBidDollars > 0 ? (
                  <>
                    {" "}
                    (max ${(MAX_BID_DROP_PER_BID_CENTS / 100).toFixed(0)} drop per bid; between{" "}
                    <span className="tabular-nums font-medium text-foreground dark:text-gray-200">
                      ${minAllowedBidDollars.toFixed(2)}
                    </span>{" "}
                    and{" "}
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

          <div className="space-y-3 px-4 py-4 sm:px-5">
            <Label
              htmlFor="bid-amount"
              className={cn(
                "block font-medium text-foreground dark:text-gray-100",
                isCleaner ? "text-base" : "text-sm"
              )}
            >
              Your bid amount
            </Label>
            {/* Cap width on large viewports — matches submit button (sm:max-w-md); full width on narrow screens */}
            <div className="relative w-full max-w-md">
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
                min={maxAllowedBidDollars > 0 ? minAllowedBidDollars : 0.01}
                max={maxAllowedBidDollars > 0 ? maxAllowedBidDollars : undefined}
                placeholder={maxAllowedBidDollars > 0 ? maxAllowedBidDollars.toFixed(2) : "0.00"}
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                className={cn(
                  // Input applies md:px-3; without md:pl-* the $ prefix overlaps the value.
                  "w-full min-h-[48px] border-2 pl-8 font-semibold tabular-nums md:pl-11",
                  isCleaner ? "h-14 text-xl md:pl-[2.85rem]" : "h-12 text-lg",
                  "focus-visible:ring-2 focus-visible:ring-primary/30",
                  "dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-100"
                )}
                autoComplete="off"
                aria-describedby="bid-amount-hint"
              />
            </div>
            <p
              id="bid-amount-hint"
              className={cn(
                "max-w-md leading-relaxed text-muted-foreground dark:text-gray-500",
                isCleaner ? "text-sm" : "text-[11px]"
              )}
            >
              Enter dollars and cents. We&apos;ll validate against the live lowest bid when you submit.
            </p>

            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full gap-2 font-semibold shadow-sm sm:max-w-md",
                isCleaner ? "h-14 min-h-14 text-lg" : "h-12 min-h-[48px] text-base"
              )}
              size="lg"
            >
              <Gavel className={cn("shrink-0 opacity-90", isCleaner ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
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
