"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { placeBid } from "@/lib/actions/bids";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/lib/listings";
import type { ListingRow } from "@/lib/listings";
import {
  MAX_BID_DROP_PER_BID_CENTS,
  parseBidDollarsStringToCents,
} from "@/lib/bidding-rules";
import { cn, parseUtcTimestamp } from "@/lib/utils";
import { ConnectRequiredModal } from "@/components/features/connect-required-modal";
import { BuyNowButton } from "@/components/features/buy-now-button";
import {
  addPendingBid,
  notifyPendingBidsChanged,
  registerSyncPendingBids,
} from "@/lib/offline-bids-db";
import { useToast } from "@/components/ui/use-toast";
import { showAppErrorToast } from "@/components/errors/show-app-error-toast";
import { getFriendlyError } from "@/lib/errors/friendly-messages";
import { logClientError } from "@/lib/errors/log-client-error";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAmountCents, setPendingAmountCents] = useState<number | null>(null);

  const isLive = listing.status === "live" && parseUtcTimestamp(listing.end_time) > Date.now();
  const currentLowest = listing.current_lowest_bid_cents;
  /** Highest allowed bid in dollars (1¢ below current lowest — reverse auction). */
  const maxAllowedBidDollars = Math.max(0, (currentLowest - 1) / 100);
  /** Lowest allowed bid: at most $100 below current lowest in one step. */
  const minAllowedBidCents = Math.max(1, currentLowest - MAX_BID_DROP_PER_BID_CENTS);
  const minAllowedBidDollars = minAllowedBidCents / 100;

  const listingLabel =
    listing.title?.trim() ||
    [listing.suburb, listing.postcode].filter(Boolean).join(", ").trim() ||
    "this listing";

  const executePlaceBid = async (amount: number) => {
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
        setConfirmOpen(false);
        setPendingAmountCents(null);
      } catch (err) {
        logClientError("placeBid.offlineQueue", err);
        showAppErrorToast(toast, {
          flow: "bid",
          error: err,
          context: "placeBid.offlineQueue",
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
      setConfirmOpen(false);
      setPendingAmountCents(null);
      toast({
        title: "Bid sent",
        description: "Your bid was placed successfully.",
      });
      router.refresh();
    } else {
      setConfirmOpen(false);
      setPendingAmountCents(null);
      const errMsg = result.error ?? "";
      logClientError("placeBid", errMsg, { listingId });
      if (errMsg.toLowerCase().includes(CONNECT_ERROR_MARKER) && currentUserId) {
        setConnectModalOpen(true);
      } else {
        const friendly = getFriendlyError("bid", new Error(errMsg));
        setError(`${friendly.description} — ${friendly.nextAction}`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = parseBidDollarsStringToCents(amountDollars);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    const amount = parsed.cents;
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

    setPendingAmountCents(amount);
    setConfirmOpen(true);
  };

  const handleConfirmPlaceBid = () => {
    if (pendingAmountCents == null) return;
    void executePlaceBid(pendingAmountCents);
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
          {isCleaner &&
            typeof listing.buy_now_cents === "number" &&
            listing.buy_now_cents > 0 &&
            currentLowest < listing.buy_now_cents && (
              <div className="border-b border-sky-500/25 bg-gradient-to-br from-sky-500/[0.12] via-sky-500/[0.05] to-transparent px-4 py-3.5 dark:border-sky-900/40 dark:from-sky-950/40 dark:via-sky-950/25 dark:to-transparent sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">
                  Buy now unavailable at current bid
                </p>
                <p className="mt-1 text-xs leading-snug text-sky-900/90 dark:text-sky-100/80">
                  The lowest bid is already below the buy-now price ({formatCents(listing.buy_now_cents)}).
                  Please continue bidding to remain competitive until the lister selects a winning bidder.
                </p>
              </div>
            )}

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
              Enter dollars with up to two decimal places (e.g. 250.50). We&apos;ll validate against the
              live lowest bid when you submit.
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

          {isCleaner &&
            typeof listing.buy_now_cents === "number" &&
            listing.buy_now_cents > 0 &&
            currentLowest >= listing.buy_now_cents && (
              <div className="border-t border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.14] via-emerald-500/[0.06] to-transparent px-4 py-3.5 dark:border-emerald-900/40 dark:from-emerald-950/45 dark:via-emerald-950/25 dark:to-transparent sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Buy it now
                </p>
                <p className="mt-1 text-xs leading-snug text-emerald-900/90 dark:text-emerald-100/80">
                  Lock in this job at the buy-now price — no need to undercut the current lowest bid.
                </p>
                <BuyNowButton
                  listingId={listingId}
                  buyNowCents={listing.buy_now_cents}
                  currentUserId={currentUserId}
                  className="mt-3 w-full min-h-12 justify-center px-4 text-base font-bold tracking-wide shadow-sm sm:min-h-[3.25rem]"
                />
              </div>
            )}
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

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && isSubmitting) return;
          setConfirmOpen(open);
          if (!open) setPendingAmountCents(null);
        }}
      >
        <DialogContent className="max-w-md dark:border-gray-800 dark:bg-gray-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Place a bid?</DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed dark:text-gray-400">
              You&apos;re about to place a bid on{" "}
              <span className="font-medium text-foreground dark:text-gray-200">{listingLabel}</span>
              {pendingAmountCents != null ? (
                <>
                  {" "}
                  for{" "}
                  <span className="font-semibold tabular-nums text-foreground dark:text-gray-100">
                    ${(pendingAmountCents / 100).toFixed(2)}
                  </span>
                </>
              ) : null}
              . Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 dark:border-gray-600 dark:hover:bg-gray-800"
              disabled={isSubmitting}
              onClick={() => {
                setConfirmOpen(false);
                setPendingAmountCents(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-12 gap-2 font-semibold"
              disabled={isSubmitting || pendingAmountCents == null}
              onClick={handleConfirmPlaceBid}
            >
              <Gavel className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {isSubmitting ? "Placing bid…" : "Place Bid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
