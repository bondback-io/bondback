"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useFindJobsMap } from "@/components/find-jobs/find-jobs-map-context";
import { PlaceBidForm } from "@/components/features/place-bid-form";
import { ListingPublicCommentsDock } from "@/components/features/listing-public-comments-dock";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchListingCommentsPublic } from "@/lib/actions/listing-comments";
import type { ListingCommentPublic } from "@/lib/actions/listing-comments";
import { shouldShowPublicListingComments } from "@/lib/listing-public-comments-visibility";
import { formatCents } from "@/lib/listings";
import { hrefListingOrJob } from "@/lib/navigation/listing-or-job-href";
import { cn } from "@/lib/utils";
import { CountdownTimer } from "@/components/features/countdown-timer";
import type { ListingRow } from "@/lib/listings";

function useLgUp() {
  const [lgUp, setLgUp] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setLgUp(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return lgUp;
}

function FindJobsDetailInner({
  listing,
  onBack,
}: {
  listing: ListingRow;
  onBack: () => void;
}) {
  const { viewerIsCleaner, viewerUserId, viewerActiveRole } = useFindJobsMap();

  const [comments, setComments] = React.useState<ListingCommentPublic[] | null>(null);
  const [commentsLoading, setCommentsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!listing) {
      setComments(null);
      return;
    }
    if (!shouldShowPublicListingComments(listing, false)) {
      setComments([]);
      setCommentsLoading(false);
      return;
    }
    let cancelled = false;
    setCommentsLoading(true);
    void fetchListingCommentsPublic(String(listing.id), String(listing.lister_id)).then(
      (rows) => {
        if (!cancelled) {
          setComments(rows);
          setCommentsLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [listing]);

  const showQa =
    listing &&
    shouldShowPublicListingComments(listing, false) &&
    comments !== null;

  const uid = viewerUserId;
  const listerId = String(listing.lister_id);
  const isOwner = uid != null && String(uid) === listerId;
  const ownerListerSession = Boolean(isOwner && viewerActiveRole === "lister");
  const listerActiveViewingOthersListing = Boolean(
    uid && viewerActiveRole === "lister" && String(uid) !== listerId
  );

  const fullHref = hrefListingOrJob(
    { id: listing.id, status: listing.status, end_time: listing.end_time },
    undefined
  );

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5 dark:border-gray-800">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-primary"
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to map
        </Button>
        <Button variant="outline" size="sm" className="ml-auto text-xs" asChild>
          <Link href={fullHref}>Full page</Link>
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4 pb-8 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Live</Badge>
            <span className="text-xs text-muted-foreground dark:text-gray-400">Current bid</span>
            <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCents(listing.current_lowest_bid_cents ?? 0)}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-snug text-foreground dark:text-gray-100">
              {listing.title ?? "Bond clean"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
              {[listing.suburb, listing.postcode].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground dark:text-gray-500">Ends </span>
              <CountdownTimer
                endTime={listing.end_time}
                expiredLabel="Ended"
                className="inline font-semibold tabular-nums"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 dark:border-gray-800 dark:bg-gray-900/50">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Place a bid
            </p>
            <div className="mt-2">
              <PlaceBidForm
                listingId={String(listing.id)}
                listing={listing}
                isCleaner={viewerIsCleaner}
                currentUserId={viewerUserId}
              />
            </div>
          </div>

          {listing.description ? (
            <div>
              <h3 className="text-sm font-semibold text-foreground dark:text-gray-200">Details</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
                {listing.description}
              </p>
            </div>
          ) : null}

          <div className="border-t border-border pt-4 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-foreground dark:text-gray-200">
              Questions &amp; answers
            </h3>
            {commentsLoading && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading…
              </div>
            )}
            {!commentsLoading && showQa && comments && (
              <div className="mt-3">
                <ListingPublicCommentsDock
                  listingId={String(listing.id)}
                  listerId={listerId}
                  initialComments={comments}
                  currentUserId={viewerUserId}
                  ownerListerSession={ownerListerSession}
                  listerActiveViewingOthersListing={listerActiveViewingOthersListing}
                />
              </div>
            )}
            {!commentsLoading && listing && !shouldShowPublicListingComments(listing, false) && (
              <p className="mt-2 text-sm text-muted-foreground dark:text-gray-500">
                Public Q&amp;A isn&apos;t open for this listing. Open the full page for more.
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </>
  );
}

/** Desktop: slides over the map column. Mobile: use {@link FindJobsMobileDetailSheet}. */
export function FindJobsDetailSlidePanel() {
  const reduceMotion = useReducedMotion();
  const { detailListing, setDetailListing } = useFindJobsMap();

  return (
    <AnimatePresence>
      {detailListing ? (
        <motion.div
          key={String(detailListing.id)}
          role="dialog"
          aria-modal="true"
          aria-label="Job details"
          initial={reduceMotion ? false : { x: "100%", opacity: 0.98 }}
          animate={reduceMotion ? undefined : { x: 0, opacity: 1 }}
          exit={reduceMotion ? undefined : { x: "100%", opacity: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
          className={cn(
            "absolute inset-y-0 right-0 z-[500] hidden w-full max-w-md flex-col border-l border-border bg-background shadow-2xl dark:border-gray-800 dark:bg-gray-950",
            "lg:flex lg:max-w-[26rem]"
          )}
        >
          <FindJobsDetailInner listing={detailListing} onBack={() => setDetailListing(null)} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Mobile: full-height sheet (map column is hidden on small screens). */
export function FindJobsMobileDetailSheet() {
  const lgUp = useLgUp();
  const { detailListing, setDetailListing } = useFindJobsMap();
  const open = Boolean(detailListing) && !lgUp;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && setDetailListing(null)}>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col gap-0 overflow-hidden p-0 lg:hidden"
      >
        <SheetTitle className="sr-only">Job details</SheetTitle>
        {detailListing ? (
          <FindJobsDetailInner listing={detailListing} onBack={() => setDetailListing(null)} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
