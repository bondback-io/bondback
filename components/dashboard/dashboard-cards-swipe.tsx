"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Gavel, MessageCircle, XCircle } from "lucide-react";
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

/** Lister live listing: swipe right → view bids; swipe left → cancel (confirm + undo toast) */
export function DashboardListingCardWithSwipe(props: DashboardListingCardProps) {
  const router = useRouter();
  const { toast, dismiss } = useToast();
  const { listing, compact } = props;
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const pendingRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const listingId = String(listing.id);

  const clearPending = React.useCallback(() => {
    if (pendingRef.current != null) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }
  }, []);

  React.useEffect(() => () => clearPending(), [clearPending]);

  const scheduleCancelFlow = React.useCallback(() => {
    clearPending();
    const toastId = `cancel-listing-${listingId}-${Date.now()}`;
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      router.push(`/my-listings?cancel=${listingId}`);
      dismiss(toastId);
    }, 2800);
    toast({
      id: toastId,
      title: "Opening cancellation",
      description: "Confirm on the next screen. Undo to stay here.",
      actionButton: {
        label: "Undo",
        onClick: () => {
          clearPending();
        },
      },
    });
  }, [clearPending, dismiss, listingId, router, toast]);

  return (
    <>
      <CardSwipeActions
        rightIcon={Gavel}
        leftIcon={XCircle}
        rightActionLabel="View bids"
        leftActionLabel="Cancel"
        onSwipeRight={() => router.push(`/jobs/${listingId}`)}
        onSwipeLeft={
          compact
            ? undefined
            : () => {
                setCancelOpen(true);
              }
        }
      >
        <DashboardListingCard {...props} />
      </CardSwipeActions>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm dark:border-gray-800 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Cancel this listing?</DialogTitle>
            <DialogDescription>
              You will be taken to My Listings to confirm cancellation. This cannot be undone from
              here alone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Keep listing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setCancelOpen(false);
                scheduleCancelFlow();
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
