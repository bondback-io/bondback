"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { JobCard } from "@/components/ui/job-card";
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

/** Cleaner active job — actions are on the card (View, Message, Mark complete). */
export function DashboardJobCardWithSwipe(props: DashboardJobCardProps) {
  return <JobCard {...props} />;
}

/** Lister live listing — cancel confirmation dialog; other actions on the card. */
export function DashboardListingCardWithSwipe(props: DashboardListingCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { listing } = props;
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
      <DashboardListingCard {...props} onCancelClick={openCancelDialog} />

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
