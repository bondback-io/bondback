"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Eye, Gavel, MessageCircle, XCircle } from "lucide-react";
import { CardSwipeActions } from "@/components/features/card-swipe-actions";
import { DashboardJobCard } from "@/components/dashboard/dashboard-job-card";
import type { DashboardJobCardProps } from "@/components/dashboard/dashboard-job-card";
import { DashboardListingCard } from "@/components/dashboard/dashboard-listing-card";
import type { DashboardListingCardProps } from "@/components/dashboard/dashboard-listing-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

/** Cleaner active job: swipe right → mark complete (confirm) or open job; swipe left → message lister */
export function DashboardJobCardWithSwipe(props: DashboardJobCardProps) {
  const router = useRouter();
  const { job } = props;
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const canComplete = job.status === "in_progress";

  return (
    <>
      <CardSwipeActions
        rightIcon={canComplete ? CheckCircle : Gavel}
        leftIcon={MessageCircle}
        rightActionLabel={canComplete ? "Complete" : "View"}
        leftActionLabel="Message"
        onSwipeRight={() => {
          if (canComplete) setCompleteOpen(true);
          else router.push(`/jobs/${job.id}`);
        }}
        onSwipeLeft={() => router.push(`/messages?job=${job.id}`)}
      >
        <DashboardJobCard {...props} />
      </CardSwipeActions>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-sm dark:border-gray-800 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Mark job complete?</DialogTitle>
            <DialogDescription>
              Only mark complete when the bond clean is finished and the lister can inspect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCompleteOpen(false)}>
              Not yet
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600"
              onClick={() => {
                setCompleteOpen(false);
                router.push(`/jobs/${job.id}?complete=1`);
              }}
            >
              Mark complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Lister live listing: swipe right → view listing; swipe left → cancel confirmation; footer Cancel uses same dialog. */
export function DashboardListingCardWithSwipe(props: DashboardListingCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { listing, compact } = props;
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [cancellingListing, setCancellingListing] = React.useState(false);

  const listingId = String(listing.id);

  const openCancelDialog = React.useCallback(() => {
    setCancelDialogOpen(true);
  }, []);

  const runCancelListing = React.useCallback(async () => {
    setCancellingListing(true);
    try {
      const { cancelListing } = await import("@/lib/actions/listings");
      const res = await cancelListing(listingId);
      if (res.ok) {
        setCancelDialogOpen(false);
        toast({
          title: "Listing cancelled",
          description: "The auction has ended early. Your dashboard will update shortly.",
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Could not cancel listing",
          description: res.error,
        });
      }
    } finally {
      setCancellingListing(false);
    }
  }, [listingId, router, toast]);

  return (
    <>
      <CardSwipeActions
        rightIcon={Eye}
        leftIcon={XCircle}
        rightActionLabel="View Listing"
        leftActionLabel="Cancel"
        onSwipeRight={() => router.push(`/jobs/${listingId}`)}
        onSwipeLeft={
          compact
            ? undefined
            : () => {
                openCancelDialog();
              }
        }
      >
        <DashboardListingCard {...props} onCancelClick={openCancelDialog} />
      </CardSwipeActions>

      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          if (!cancellingListing) setCancelDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-md dark:border-gray-800 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Cancel this listing?</DialogTitle>
            <DialogDescription className="text-left">
              This will end the auction early. No new bids will be accepted, and cleaners who bid will see that the
              listing has ended. The listing stays in your history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancellingListing}
            >
              Keep listing live
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancellingListing}
              onClick={() => void runCancelListing()}
            >
              {cancellingListing ? "Cancelling…" : "Yes, end listing early"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
