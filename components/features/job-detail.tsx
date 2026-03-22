"use client";

import { useEffect, useState, useTransition, useCallback, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { CountdownTimer } from "@/components/features/countdown-timer";
import { BidHistoryTable } from "@/components/features/bid-history-table";
import { PlaceBidForm } from "@/components/features/place-bid-form";
import { BuyNowButton } from "@/components/features/buy-now-button";
import { formatCents } from "@/lib/listings";
import { parseUtcTimestamp } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ListingRow } from "@/lib/listings";
import type { BidRow } from "@/lib/listings";
import { Checkbox } from "@/components/ui/checkbox";
import { ImagePlus, CheckCircle2, Star, MapPin, X, ImageIcon } from "lucide-react";
import { ReviewForm } from "@/components/features/review-form";
import { GuidedDisputeForm } from "@/components/features/guided-dispute-form";
import { useToast } from "@/components/ui/use-toast";
import { useIsOffline } from "@/hooks/use-offline";
import { respondToDispute, acceptResolution, acceptRefund, counterRefund, rejectRefund, acceptCounterRefund, acceptBid } from "@/lib/actions/jobs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  validatePhotoFiles,
  PHOTO_LIMITS,
  PHOTO_VALIDATION,
  checkImageHeader,
} from "@/lib/photo-validation";
import { uploadProcessedPhotos } from "@/lib/actions/upload-photos";
import { getStateFromPostcode, formatLocationWithState } from "@/lib/state-from-postcode";
import { getBondGuidelineForState } from "@/lib/bond-cleaning-guidelines";
import { JobPaymentTimeline, type JobPaymentTimelineProps } from "@/components/features/job-payment-timeline";
import { JobPaymentBreakdown } from "@/components/features/job-payment-breakdown";
import { VerificationBadges } from "@/components/shared/verification-badges";
export type BidWithBidder = BidRow & { bidder_email?: string | null };

export type JobDetailProps = {
  listingId: string;
  initialListing: ListingRow;
  initialBids: BidWithBidder[];
  isCleaner: boolean;
  hasActiveJob?: boolean;
  jobId?: string | null;
  jobStatus?: string | null;
  isJobLister?: boolean;
  isJobCleaner?: boolean;
  /** True when the current user owns the listing (lister). Used to allow adding initial photos even when there is no job yet. */
  isListingOwner?: boolean;
  /** Lister's display name (when job exists). */
  listerName?: string | null;
  cleanerName?: string | null;
  /** Profile verification badges for lister / cleaner (job header trust row). */
  listerVerificationBadges?: string[] | null;
  cleanerVerificationBadges?: string[] | null;
  /** When the job was created with `status = "accepted"` (defaults to job.created_at). */
  jobAcceptedAt?: string | null;
  /** When the cleaner marked the job complete (used for the 48h review timer). */
  completedAt?: string | null;
  /** When auto-release is due (used for the 48h countdown on admin/lister review). */
  autoReleaseAt?: string | null;
  /** Review window duration hours (defaults to 48). */
  autoReleaseHours?: number;
  cleanerConfirmedComplete?: boolean;
  cleanerConfirmedAt?: string | null;
  /** Who opened the dispute (when status is disputed/in_review). */
  disputeOpenedBy?: "lister" | "cleaner" | null;
  /** True when the other party has submitted a dispute response. */
  hasDisputeResponse?: boolean;
  /** Agreed job amount in cents (for partial refund slider). */
  agreedAmountCents?: number;
  /** Lister's proposed refund in cents (when status = dispute_negotiating). */
  proposedRefundAmount?: number | null;
  /** Cleaner's counter proposal in cents. */
  counterProposalAmount?: number | null;
  /** Transaction timeline (payment released, refund). */
  paymentTimeline?: JobPaymentTimelineProps | null;
  /** True when lister has secured payment (Stripe hold) for this job. */
  hasPaymentHold?: boolean;
  /** True when Admin > Global Settings has Stripe test mode on (uses test keys from .env). */
  isStripeTestMode?: boolean;
  /** Current user id (for Connect required modal when cleaner tries Secure at price / bid without bank). */
  currentUserId?: string | null;
  /** Platform fee % (from global settings) for payment breakdown. Lister pays this on top of job price. */
  feePercentage?: number;
  /** True when current user (lister) has already submitted a review of the cleaner for this job. */
  hasReviewedCleaner?: boolean;
  /** True when current user (cleaner) has already submitted a review of the lister for this job. */
  hasReviewedLister?: boolean;
  /** True when review is allowed (completed + escrow released). */
  canLeaveReview?: boolean;
};

type ChecklistItem = {
  id: number;
  job_id: number;
  label: string;
  is_completed: boolean;
};

export function JobDetail({
  listingId,
  initialListing,
  initialBids,
  isCleaner,
  hasActiveJob = false,
  jobId = null,
  jobStatus = null,
  isJobLister = false,
  isJobCleaner = false,
  isListingOwner = false,
  listerName = null,
  cleanerName = null,
  listerVerificationBadges = null,
  cleanerVerificationBadges = null,
  jobAcceptedAt = null,
  completedAt = null,
  autoReleaseAt = null,
  autoReleaseHours = 48,
  cleanerConfirmedComplete = false,
  cleanerConfirmedAt = null,
  disputeOpenedBy = null,
  hasDisputeResponse = false,
  agreedAmountCents = 0,
  proposedRefundAmount = null,
  counterProposalAmount = null,
  paymentTimeline = null,
  hasPaymentHold = false,
  isStripeTestMode = false,
  currentUserId = null,
  feePercentage = 12,
  hasReviewedCleaner = false,
  hasReviewedLister = false,
  canLeaveReview = false,
}: JobDetailProps) {
  const [listing, setListing] = useState<ListingRow>(initialListing);
  const [bids, setBids] = useState<BidWithBidder[]>(initialBids);
  const [localJobStatus, setLocalJobStatus] = useState<string | null>(
    jobStatus ?? (hasActiveJob ? "accepted" : null)
  );
  const [cancellingJob, setCancellingJob] = useState(false);
  const [showCancelJobDialog, setShowCancelJobDialog] = useState(false);
  const [isApproving, startApproving] = useTransition();
  const [isFinalizing, startFinalizing] = useTransition();
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [cleanerConfirmed, setCleanerConfirmed] = useState<boolean>(
    cleanerConfirmedComplete
  );
  const [confirmedAt, setConfirmedAt] = useState<string | null>(
    cleanerConfirmedAt
  );
  type InitialPhotoEntry = { name: string; url: string };
  type AfterPhotoEntry = { name: string; url: string };
  const [afterPhotoEntries, setAfterPhotoEntries] = useState<AfterPhotoEntry[]>([]);
  const [afterPhotosLoading, setAfterPhotosLoading] = useState(false);
  const [afterPhotosUploading, setAfterPhotosUploading] = useState(false);
  const [initialPhotoEntries, setInitialPhotoEntries] = useState<InitialPhotoEntry[]>([]);
  const [initialPhotosLoading, setInitialPhotosLoading] = useState(false);
  const [fundsReadyNotified, setFundsReadyNotified] = useState(false);
  const [reviewEndsAt, setReviewEndsAt] = useState<string | null>(null);
  const [initialPhotosUploading, setInitialPhotosUploading] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const router = useRouter();
  const { toast } = useToast();
  const isOffline = useIsOffline();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showListerFinalizeNotice, setShowListerFinalizeNotice] =
    useState(false);
  const [submittedCleanerReview, setSubmittedCleanerReview] = useState(false);
  const [submittedListerReview, setSubmittedListerReview] = useState(false);
  const [showCleanerReviewForm, setShowCleanerReviewForm] = useState(false);
  const [showListerReviewForm, setShowListerReviewForm] = useState(false);
  const [showOpenDisputeForm, setShowOpenDisputeForm] = useState(false);
  const [showRaiseDisputeForm, setShowRaiseDisputeForm] = useState(false);
  const [disputeResponseReason, setDisputeResponseReason] = useState("");
  const [disputeResponseMessage, setDisputeResponseMessage] = useState("");
  const [disputeResponsePhotos, setDisputeResponsePhotos] = useState<File[]>([]);
  const [isSubmittingResponse, startSubmitResponse] = useTransition();
  const [responseSubmitted, setResponseSubmitted] = useState(false);
  const [isAcceptingResolution, startAcceptResolution] = useTransition();
  const [isAcceptingRefund, startAcceptRefund] = useTransition();
  const [isCounteringRefund, startCounteringRefund] = useTransition();
  const [isRejectingRefund, startRejectingRefund] = useTransition();
  const [isAcceptingCounter, startAcceptCounter] = useTransition();
  const [showCounterDialog, setShowCounterDialog] = useState(false);
  const handleAcceptBid = useCallback(
    async (bid: BidWithBidder) => {
      const result = await acceptBid(listingId, bid.cleaner_id, bid.amount_cents);
      if (result.ok) {
        toast({ title: "Bid accepted", description: "Job created. Pay & Start Job to hold funds in escrow and start the job." });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Could not accept bid", description: result.error });
      }
    },
    [listingId, toast, router]
  );
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [counterAmountCents, setCounterAmountCents] = useState(0);
  const [counterMessage, setCounterMessage] = useState("");
  const supabase = createBrowserSupabaseClient();

  const numericJobId = jobId != null ? Number(jobId) : null;

  useEffect(() => {
    const ch = supabase
      .channel(`listing-${listingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "listings",
          filter: `id=eq.${listingId}`
        },
        (payload) => {
          setListing(payload.new as ListingRow);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `listing_id=eq.${listingId}`
        },
        (payload) => {
          setBids((prev) => [payload.new as BidWithBidder, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, listingId]);

  // Live countdown timers (e.g. auto-release countdown during review window)
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Realtime job status updates (accepted → in_progress → completed)
  useEffect(() => {
    if (!numericJobId) return;

    const channel = supabase
      .channel(`job-${numericJobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "jobs",
          filter: `id=eq.${numericJobId}`,
        },
        (payload) => {
          const next = (payload.new as any) ?? null;
          if (!next) return;
          if (typeof next.status === "string") {
            setLocalJobStatus(next.status);
          }
          if (typeof next.cleaner_confirmed_complete === "boolean") {
            setCleanerConfirmed(next.cleaner_confirmed_complete);
          }
          if (next.cleaner_confirmed_at) {
            setConfirmedAt(next.cleaner_confirmed_at as string);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, numericJobId]);

  const isLive =
    listing.status === "live" && parseUtcTimestamp(listing.end_time) > Date.now();
  const isListingCancelled = String(listing.status).toLowerCase() === "cancelled";
  const isJobCancelled =
    localJobStatus === "cancelled" || jobStatus === "cancelled";
  /** Hide auction/timer/bid UI for cleaners on cancelled listing or cancelled job only */
  const hideCleanerCancelledAuctionUi =
    isCleaner && (isListingCancelled || isJobCancelled);
  const showAuctionActions =
    isLive && !hasActiveJob && !hideCleanerCancelledAuctionUi;
  const isSold = !!hasActiveJob;

  const searchParams = useSearchParams();
  const [paymentSuccessToastShown, setPaymentSuccessToastShown] = useState(false);
  useEffect(() => {
    const payment = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");
    if (paymentSuccessToastShown || payment !== "success" || !sessionId || !jobId) return;

    setPaymentSuccessToastShown(true);

    (async () => {
      try {
        const { fulfillJobPaymentFromSession } = await import("@/lib/actions/jobs");
        const res = await fulfillJobPaymentFromSession(sessionId);
        if (res.ok) {
          setLocalJobStatus("in_progress");
          toast({
            title: isStripeTestMode ? "Payment held in escrow (test mode)" : "Payment held in escrow",
            description: "Job started. The cleaner can begin work.",
          });
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: "Could not confirm payment",
            description: res.error,
          });
        }
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete("payment");
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.pathname + (url.search || ""));
      }
    })();
  }, [searchParams, paymentSuccessToastShown, isStripeTestMode, jobId, router, toast]);

  const [securingPayment, setSecuringPayment] = useState(false);
  const handleSecurePayment = async () => {
    if (!jobId) return;
    if (isOffline) {
      toast({ title: "Offline", description: "Reconnect to perform this action.", variant: "destructive" });
      return;
    }
    setSecuringPayment(true);
    try {
      const { createJobCheckoutSession } = await import(
        "@/lib/actions/jobs"
      );
      const res = await createJobCheckoutSession(jobId);
      if (res.ok && "alreadyPaid" in res && res.alreadyPaid) {
        setLocalJobStatus("in_progress");
        toast({
          title: isStripeTestMode ? "Payment held in escrow (test mode)" : "Payment held in escrow",
          description: "Job started. The cleaner can begin work.",
        });
        router.refresh();
        return;
      }
      if (res.ok && "url" in res && res.url) {
        window.location.href = res.url;
        return;
      }
      if (!res.ok) {
        const errMsg = res.error ?? "Please try again.";
        toast({
          variant: "destructive",
          title: "Pay & Start Job failed",
          description: errMsg,
        });
        return;
      }
      toast({
        variant: "destructive",
        title: "Pay & Start Job failed",
        description: "Please try again.",
      });
    } finally {
      setSecuringPayment(false);
    }
  };
  const handleApproveStart = () => {
    if (!jobId || !isJobLister || localJobStatus !== "accepted") return;
    if (isOffline) {
      toast({ title: "Offline", description: "Reconnect to perform this action.", variant: "destructive" });
      return;
    }
    startApproving(async () => {
      const { approveJobStart } = await import(
        "@/lib/actions/jobs"
      );
      const res = await approveJobStart(jobId);
      if (!res.ok) {
        alert(res.error ?? "Failed to approve job start.");
        return;
      }
      setLocalJobStatus("in_progress");
    });
  };

  useEffect(() => {
    if (
      !numericJobId ||
      (localJobStatus !== "in_progress" &&
        localJobStatus !== "completed" &&
        localJobStatus !== "completed_pending_approval")
    ) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setChecklistLoading(true);
      setChecklistError(null);
      const { data, error } = await supabase
        .from("job_checklist_items")
        .select("*")
        .eq("job_id", numericJobId as never)
        .order("id", { ascending: true });
      if (cancelled) return;
      if (error) {
        setChecklistError(error.message);
        setChecklistLoading(false);
        return;
      }
      setChecklist((data ?? []) as ChecklistItem[]);
      setChecklistLoading(false);
    };

    load();

    const channel = supabase
      .channel(`job-checklist-${numericJobId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_checklist_items",
          filter: `job_id=eq.${numericJobId}`,
        },
        (payload) => {
          setChecklist((prev) => {
            const current = prev ?? [];
            if (payload.eventType === "INSERT") {
              return [...current, payload.new as ChecklistItem];
            }
            if (payload.eventType === "UPDATE") {
              const updated = payload.new as ChecklistItem;
              return current.map((item) =>
                item.id === updated.id ? updated : item
              );
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, numericJobId, localJobStatus]);

  // Load after-photos for this job (used for funds release gating and history)
  useEffect(() => {
    if (
      !numericJobId ||
      (localJobStatus !== "in_progress" &&
        localJobStatus !== "completed" &&
        localJobStatus !== "completed_pending_approval")
    ) {
      return;
    }

    let cancelled = false;

    const loadAfterPhotos = async () => {
      setAfterPhotosLoading(true);
      const { data, error } = await supabase.storage
        .from("condition-photos")
        .list(`jobs/${numericJobId}/after`, { limit: 100 });
      if (cancelled) return;
      if (error || !data) {
        setAfterPhotoEntries([]);
        setAfterPhotosLoading(false);
        return;
      }
      const entries: AfterPhotoEntry[] = data
        .filter((file) => file.name && !file.name.startsWith("thumb_"))
        .map((file) => {
          const {
            data: { publicUrl },
          } = supabase.storage
            .from("condition-photos")
            .getPublicUrl(`jobs/${numericJobId}/after/${file.name}`);
          return { name: file.name, url: publicUrl };
        });
      setAfterPhotoEntries(entries);
      setAfterPhotosLoading(false);
    };

    loadAfterPhotos();

    return () => {
      cancelled = true;
    };
  }, [supabase, numericJobId, localJobStatus]);

  // Load initial photos from storage (same method as after-photos: list folder and build public URLs)
  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    const loadInitialPhotos = async () => {
      setInitialPhotosLoading(true);
      const { data, error } = await supabase.storage
        .from("condition-photos")
        .list(`listings/${listingId}/initial`, { limit: 100 });
      if (cancelled) return;
      if (error || !data) {
        setInitialPhotoEntries([]);
        setInitialPhotosLoading(false);
        return;
      }
      const entries: InitialPhotoEntry[] = data
        .filter((file) => file.name && !file.name.startsWith("thumb_"))
        .map((file) => {
          const {
            data: { publicUrl },
          } = supabase.storage
            .from("condition-photos")
            .getPublicUrl(`listings/${listingId}/initial/${file.name}`);
          return { name: file.name, url: publicUrl };
        });
      setInitialPhotoEntries(entries);
      setInitialPhotosLoading(false);
    };
    loadInitialPhotos();
    return () => {
      cancelled = true;
    };
  }, [supabase, listingId]);

  const handleToggleItem = async (item: ChecklistItem, next: boolean) => {
    if (!numericJobId) return;
    setChecklist((prev) =>
      (prev ?? []).map((it) =>
        it.id === item.id ? { ...it, is_completed: next } : it
      )
    );
    const { error } = await supabase
      .from("job_checklist_items")
      .update({ is_completed: next } as never)
      .eq("id", item.id as never)
      .eq("job_id", numericJobId as never);
    if (error) {
      setChecklistError(error.message);
    }
  };

  const handleMarkAllComplete = async () => {
    if (!numericJobId || !checklist || checklist.length === 0) return;
    if (isOffline) {
      toast({ title: "Offline", description: "Reconnect to perform this action.", variant: "destructive" });
      return;
    }
    const nextChecklist = checklist.map((item) => ({
      ...item,
      is_completed: true,
    }));
    setChecklist(nextChecklist);
    const { error } = await supabase
      .from("job_checklist_items")
      .update({ is_completed: true } as never)
      .eq("job_id", numericJobId as never);
    if (error) {
      setChecklistError(error.message);
    }
  };

  const handleAddItem = async (label: string) => {
    if (!numericJobId) return;
    const trimmed = label.trim();
    if (!trimmed) return;
    const { data, error } = await supabase
      .from("job_checklist_items")
      .insert({
        job_id: numericJobId,
        label: trimmed,
      } as never)
      .select("*")
      .maybeSingle();
    if (error) {
      setChecklistError(error.message);
      return;
    }
    if (data) {
      setChecklist((prev) => {
        const current = prev ?? [];
        const exists = current.some((item) => item.id === (data as ChecklistItem).id);
        if (exists) return current;
        return [...current, data as ChecklistItem];
      });
    }
  };

  const allCompleted =
    checklist &&
    checklist.length > 0 &&
    checklist.every((item) => item.is_completed);

  const completedDateLabel =
    confirmedAt != null ? format(new Date(confirmedAt), "d MMM yyyy") : null;

  const propertyAddress: string | null =
    ((listing as any).property_address as string | null) ??
    ((listing as any).propertyAddress as string | null) ??
    null;

  const hasAfterPhotos = afterPhotoEntries.length >= 3;

  const handleFinalizePayment = () => {
    if (!jobId || !isJobLister) return;
    if (isOffline) {
      toast({ title: "Offline", description: "Reconnect to perform this action.", variant: "destructive" });
      return;
    }
    // Rely on server validation; client state (checklist/after-photos) can be stale or still loading.
    startFinalizing(async () => {
      const { finalizeJobPayment } = await import("@/lib/actions/jobs");
      const res = await finalizeJobPayment(jobId);
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not release funds",
          description: res.error ?? "Failed to finalize payment.",
        });
        return;
      }
      if (isStripeTestMode && res.ok && "transferId" in res) {
        console.log("[Stripe Test] Funds released — Transfer ID:", res.transferId, "PaymentIntent ID:", res.paymentIntentId);
      }
      toast({
        title: isStripeTestMode ? "Funds released to cleaner (test mode)" : "Funds released",
        description: "The cleaner has been notified. Funds are on the way to their connected account.",
      });
      setLocalJobStatus("completed");
      setReviewEndsAt(
        new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      );
      setShowListerFinalizeNotice(true);
    });
  };

  // Notify lister when funds are ready (checklist complete + photos uploaded)
  useEffect(() => {
    if (!jobId || !isJobCleaner) return;
    if (!hasAfterPhotos) return;
    if (fundsReadyNotified) return;

    const run = async () => {
      try {
        const { notifyFundsReady } = await import("@/lib/actions/jobs");
        await notifyFundsReady(jobId);
        setFundsReadyNotified(true);
      } catch {
        // Best-effort only; ignore errors in the UI.
      }
    };

    run();
  }, [jobId, isJobCleaner, hasAfterPhotos, fundsReadyNotified]);

  const bondGuideline =
    hasActiveJob &&
    (localJobStatus === "in_progress" ||
      localJobStatus === "completed_pending_approval" ||
      localJobStatus === "completed")
      ? getBondGuidelineForState(getStateFromPostcode(listing.postcode))
      : null;

  const autoReleaseMs = autoReleaseAt ? new Date(autoReleaseAt).getTime() : null;
  const autoReleaseMsLeft =
    autoReleaseMs != null ? Math.max(0, autoReleaseMs - nowMs) : null;
  const autoReleaseHoursLeft =
    autoReleaseMsLeft != null ? autoReleaseMsLeft / (60 * 60 * 1000) : null;
  const reviewTotalMs = Math.max(1, (autoReleaseHours ?? 48) * 60 * 60 * 1000);
  const autoReleaseProgressValue =
    autoReleaseMsLeft != null
      ? Math.min(100, Math.max(0, ((reviewTotalMs - autoReleaseMsLeft) / reviewTotalMs) * 100))
      : 0;
  const autoReleaseBadgeClass =
    autoReleaseHoursLeft != null
      ? autoReleaseHoursLeft > 24
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
        : autoReleaseHoursLeft >= 6
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
          : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
      : "bg-muted text-muted-foreground";
  const formatAutoReleaseCountdown = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {paymentTimeline && (
        <JobPaymentTimeline {...paymentTimeline} />
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-xl dark:text-gray-100">{listing.title}</CardTitle>
            {!isSold && !hideCleanerCancelledAuctionUi && (
              <CountdownTimer
                endTime={listing.end_time}
                className="text-sm font-medium"
                expiredLabel="Auction ended"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasActiveJob && (listerName || cleanerName) && (
            <div className="border-b border-border pb-3 text-[11px] text-muted-foreground dark:border-gray-700 dark:text-gray-400">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                {listerName && (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>Property Lister: {listerName}</span>
                    <VerificationBadges
                      badges={listerVerificationBadges}
                      showLabel={false}
                      size="sm"
                    />
                  </span>
                )}
                {listerName && cleanerName && (
                  <span className="opacity-60" aria-hidden>
                    ·
                  </span>
                )}
                {cleanerName && (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>Assigned to: {cleanerName}</span>
                    <VerificationBadges
                      badges={cleanerVerificationBadges}
                      showLabel={false}
                      size="sm"
                    />
                    {jobAcceptedAt && (
                      <span>
                        <span className="mx-1.5">·</span>
                        Accepted on {format(new Date(jobAcceptedAt), "d MMM yyyy")}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          )}
          {isLive &&
            bids.length > 0 &&
            !hasActiveJob &&
            !hideCleanerCancelledAuctionUi && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              <span className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden />
              <span className="font-medium">
                This listing is currently live and has bids
              </span>
            </div>
          )}
          {(localJobStatus === "cancelled" || jobStatus === "cancelled") && isJobCleaner && (
            <div className="flex items-center gap-2 rounded-lg border-2 border-red-400 bg-red-50 px-4 py-3 text-sm font-medium text-red-900 dark:border-red-500 dark:bg-red-950/70 dark:text-red-100">
              <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 dark:bg-red-400" aria-hidden />
              <span>
                This job listing has been cancelled by the property lister. You have been unassigned from the job.
              </span>
            </div>
          )}
          {(localJobStatus === "cancelled" || jobStatus === "cancelled") && isJobLister && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground dark:bg-gray-800/50 dark:text-gray-300">
              <span>You have cancelled this job. The cleaner has been notified.</span>
            </div>
          )}
          {hasActiveJob && localJobStatus === "accepted" && isJobCleaner && (
            <div className="flex items-center gap-2 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-500 dark:bg-amber-950/70 dark:text-amber-100">
              <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400" aria-hidden />
              <span>
                This job has been won. Pending property lister approval to start.
              </span>
            </div>
          )}
          {hasActiveJob && (
            <div className="space-y-1 rounded-md border border-border bg-muted/40 px-4 py-3 text-[11px] dark:border-gray-700 dark:bg-gray-800/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-300">
                  Job progress
                </p>
                {localJobStatus === "accepted" && hasPaymentHold && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                    Payment held in escrow
                  </span>
                )}
                {localJobStatus === "in_progress" && !cleanerConfirmed && (
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                    Awaiting cleaner completion
                  </span>
                )}
                {(localJobStatus === "in_progress" && cleanerConfirmed) ||
                  localJobStatus === "completed_pending_approval" ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                    Awaiting property lister completion
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {[
                  {
                    label: "Accepted",
                    done: !!hasActiveJob,
                  },
                  {
                    label: "In progress",
                    done:
                      localJobStatus === "in_progress" ||
                      localJobStatus === "completed_pending_approval" ||
                      localJobStatus === "completed",
                  },
                  {
                    label: "Checklist complete",
                    done: allCompleted,
                  },
                  {
                    label: "Photos uploaded",
                    done: hasAfterPhotos,
                  },
                  {
                    label: "Funds released",
                    done: localJobStatus === "completed",
                  },
                ].map((step, index) => (
                  <div
                    key={step.label}
                    className="flex items-center gap-1 text-[11px]"
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40 dark:bg-gray-500/60" />
                    )}
                    <span
                      className={
                        step.done
                          ? "font-medium text-foreground dark:text-gray-100"
                          : "text-muted-foreground dark:text-gray-400"
                      }
                    >
                      {step.label}
                    </span>
                    {index < 4 && (
                      <span className="mx-1 h-px w-3 bg-border dark:bg-gray-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasActiveJob &&
            (localJobStatus === "in_progress" ||
              localJobStatus === "completed_pending_approval") &&
            isJobCleaner && (
              <div className="space-y-1 rounded-md border border-sky-300 bg-sky-50/70 px-4 py-3 dark:border-sky-800 dark:bg-sky-900/40">
                <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-100">
                  <MapPin className="h-3 w-3" />
                  <span>Property address</span>
                </p>
                <p className="text-sm font-medium text-sky-900 dark:text-sky-100">
                  {propertyAddress && propertyAddress.trim().length > 0
                    ? propertyAddress
                    : formatLocationWithState(listing.suburb, listing.postcode)}
                </p>
                <p className="text-[11px] text-sky-800 dark:text-sky-200">
                  This is the location for this bond clean job. Use it for your
                  maps and travel planning.
                </p>
              </div>
            )}

          {isSold ? (
            <>
              {localJobStatus === "completed" ? (
                <>
                  {isJobLister && (
                    <>
                      <div className="space-y-2 rounded-md border border-emerald-400 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-900/40">
                        <p className="text-xs font-medium uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                          Payment released
                        </p>
                        <p className="text-xl font-semibold text-emerald-900 sm:text-2xl dark:text-emerald-100">
                          {`Congratulations! Your payment of ${formatCents(
                            agreedAmountCents
                          )} has been paid to ${
                            cleanerName
                              ? cleanerName.split(" ")[0]
                              : "your cleaner"
                          }.`}
                        </p>
                      </div>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                        <div className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400">
                          <Star className="h-3 w-3 fill-amber-400 dark:fill-amber-500" />
                          <Star className="h-3 w-3 fill-amber-400 dark:fill-amber-500" />
                          <Star className="h-3 w-3 fill-amber-400 dark:fill-amber-500" />
                        </div>
                        <p>
                          Leave a review for{" "}
                          <span className="font-semibold dark:text-amber-100">
                            {cleanerName
                              ? cleanerName.split(" ")[0]
                              : "your cleaner"}
                          </span>{" "}
                          below to help other owners.
                        </p>
                      </div>
                    </>
                  )}
                  {isJobCleaner && (
                    <>
                      <div className="space-y-2 rounded-md border border-emerald-400 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-900/40">
                        <p className="text-xs font-medium uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                          Payment released
                        </p>
                        <p className="text-xl font-semibold text-emerald-900 sm:text-2xl dark:text-emerald-100">
                          {`Payment of ${formatCents(
                            agreedAmountCents
                          )} has been released to you :)`}
                        </p>
                        <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                          You received the full bid amount. The lister paid the platform fee separately.
                        </p>
                        <p className="text-[11px] text-emerald-800/90 dark:text-emerald-200/90">
                          Funds sent to your Stripe account – automatic payout in 2–7 days, or use Withdraw Now in Settings → Payments.
                        </p>
                      </div>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                        <div className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400">
                          <Star className="h-3 w-3 fill-amber-400 dark:fill-amber-500" />
                          <Star className="h-3 w-3 fill-amber-400 dark:fill-amber-500" />
                          <Star className="h-3 w-3 fill-amber-400 dark:fill-amber-500" />
                        </div>
                        <p>
                          Leave a review for the owner below to share your experience.
                        </p>
                      </div>
                    </>
                  )}
                  {!isJobLister && !isJobCleaner && (
                    <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50/70 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/40">
                      <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                        Won for
                      </p>
                      <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatCents(agreedAmountCents)}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50/70 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/40">
                  <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                    Won for
                  </p>
                  <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                    {formatCents(agreedAmountCents)}
                  </p>
                  {isJobCleaner && (
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                      You will receive the full bid amount ({formatCents(agreedAmountCents)}). The lister pays the platform fee separately.
                    </p>
                  )}
                </div>
              )}
              {/* Platform fee breakdown handled above; avoid duplicating copy here. */}
            </>
          ) : hideCleanerCancelledAuctionUi ? (
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              This listing is no longer accepting bids.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">
                  Starting / Est.
                </p>
                <p className="text-lg font-semibold dark:text-gray-100">
                  {formatCents(listing.starting_price_cents)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">
                  Current lowest bid
                </p>
                <p className="text-lg font-semibold text-accent dark:text-accent">
                  {formatCents(listing.current_lowest_bid_cents)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">
                  Reserve
                </p>
                <p className="text-lg font-semibold dark:text-gray-100">
                  {formatCents(listing.reserve_cents)}
                </p>
              </div>
              {listing.buy_now_cents != null &&
                listing.buy_now_cents > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">
                      Fixed price
                    </p>
                    <p className="text-lg font-semibold dark:text-gray-100">
                      {formatCents(listing.buy_now_cents)}
                    </p>
                    {listing.current_lowest_bid_cents <
                      listing.buy_now_cents && (
                      <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                        Current bid is below the fixed price. Securing at this price may no longer be available.
                      </p>
                    )}
                  </div>
                )}
            </div>
          )}

          {bondGuideline && (
            <details className="mt-2 text-xs text-muted-foreground dark:text-gray-400">
              <summary className="cursor-pointer select-none dark:text-gray-300">
                Bond cleaning guideline ({bondGuideline.state})
              </summary>
              <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/30">
                <p className="text-[11px] dark:text-gray-200">
                  {bondGuideline.summary}
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-[11px] dark:text-gray-200">
                  {bondGuideline.checklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                {bondGuideline.linkUrl && bondGuideline.linkLabel && (
                  <p className="pt-1">
                    <a
                      href={bondGuideline.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline dark:text-sky-300"
                    >
                      {bondGuideline.linkLabel}
                    </a>
                  </p>
                )}
              </div>
            </details>
          )}

          {!(isCleaner && hideCleanerCancelledAuctionUi) && (
          <details className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground dark:border-gray-700 dark:text-gray-500">
            <summary className="cursor-pointer select-none py-1 hover:text-foreground dark:hover:text-gray-300">
              View bid history
            </summary>
            {bids.length > 0 ? (
              <div className="mt-2">
                <BidHistoryTable
                  bids={bids}
                  onAcceptBid={
                    isListingOwner && !hasActiveJob ? handleAcceptBid : undefined
                  }
                />
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground dark:text-gray-400">
                No bids were placed on this listing.
              </p>
            )}
          </details>
          )}

          {/* Escrow flow: Pay & Start Job (Stripe) then optionally Start Job if webhook hasn't moved status yet */}
          {hasActiveJob && localJobStatus === "accepted" && (
            <div className="mt-2 space-y-2 rounded-md border bg-background/60 px-3 py-2 text-xs sm:text-sm dark:border-gray-700 dark:bg-gray-800/50">
              {isJobLister && !hasPaymentHold && agreedAmountCents > 0 && (
                <JobPaymentBreakdown
                  agreedAmountCents={agreedAmountCents}
                  feePercentage={feePercentage}
                  isStripeTestMode={isStripeTestMode}
                  variant="pay"
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-medium dark:text-gray-100">
                    {isJobLister
                      ? hasPaymentHold
                        ? "Payment held in escrow"
                        : "Awaiting payment"
                      : "Pending lister payment"}
                  </p>
                  <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                    {isJobLister
                      ? hasPaymentHold
                        ? "Funds are held in escrow. Start the job so the cleaner can see the checklist and begin."
                        : "Pay the job price plus the platform fee to place funds into escrow and unlock the checklist for your cleaner."
                      : "The lister is reviewing and confirming the job. You can message them below in the meantime."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isJobLister ? (
                    hasPaymentHold ? (
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={handleApproveStart}
                      disabled={isApproving}
                      variant="default"
                    >
                      {isApproving ? "Starting…" : "Start Job"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="text-xs"
                        onClick={handleSecurePayment}
                        disabled={securingPayment}
                        variant="default"
                      >
                        {securingPayment ? "Redirecting to payment…" : "Pay & Start Job"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/50"
                        onClick={() => setShowCancelJobDialog(true)}
                        disabled={cancellingJob}
                      >
                        {cancellingJob ? "Cancelling…" : "Cancel Job"}
                      </Button>
                    </>
                  )
                ) : (
                  <span className="text-muted-foreground">Awaiting property lister to approve and start job…</span>
                )}
                </div>
              </div>
            </div>
          )}

          <Dialog open={showCancelJobDialog} onOpenChange={setShowCancelJobDialog}>
            <DialogContent className="max-w-md dark:border-gray-700 dark:bg-gray-900">
              <DialogHeader>
                <DialogTitle>Cancel this job?</DialogTitle>
                <DialogDescription>
                  The cleaner will be unassigned and notified. You can list again later if needed. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCancelJobDialog(false)} disabled={cancellingJob}>
                  Keep job
                </Button>
                <Button
                  variant="destructive"
                  disabled={cancellingJob}
                  onClick={async () => {
                    if (!jobId) return;
                    setCancellingJob(true);
                    try {
                      const { cancelJobByLister } = await import("@/lib/actions/jobs");
                      const res = await cancelJobByLister(jobId);
                      if (res.ok) {
                        setLocalJobStatus("cancelled");
                        setShowCancelJobDialog(false);
                        toast({ title: "Job cancelled", description: "The cleaner has been notified." });
                        router.refresh();
                      } else {
                        toast({ variant: "destructive", title: "Could not cancel job", description: res.error });
                      }
                    } finally {
                      setCancellingJob(false);
                    }
                  }}
                >
                  {cancellingJob ? "Cancelling…" : "Yes, cancel job"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Shown only when Stripe test mode is enabled in Admin > Global Settings */}
          {isStripeTestMode &&
            isJobLister &&
            hasActiveJob &&
            (localJobStatus === "accepted" ||
              localJobStatus === "in_progress" ||
              localJobStatus === "completed_pending_approval") && (
            <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-950/40">
              <p className="font-medium text-amber-900 dark:text-amber-200">Test cards (Stripe test mode)</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-800 dark:text-amber-300">
                <li><code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">4242 4242 4242 4242</code> — success</li>
                <li><code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">4000 0000 0000 3220</code> — requires authentication</li>
              </ul>
              <p className="mt-1 text-amber-700 dark:text-amber-400">Use any future expiry and CVC. No real charges.</p>
            </div>
          )}

          {hasActiveJob &&
            (localJobStatus === "in_progress" ||
              localJobStatus === "completed" ||
              localJobStatus === "completed_pending_approval") &&
            numericJobId && (
            <>
              {localJobStatus === "in_progress" && (
                <div className="space-y-3 rounded-md border bg-background/60 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium dark:text-gray-100">Cleaning checklist</p>
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        {isJobLister
                          ? "Add or adjust tasks, including any extras. Your cleaner will see updates in real time."
                          : "Work through the agreed tasks and tick them off as you go."}
                      </p>
                    </div>
                  </div>

                  {checklistLoading && (
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      Loading checklist…
                    </p>
                  )}
                  {checklistError && (
                    <p className="text-xs text-destructive dark:text-red-400">
                      {checklistError}
                    </p>
                  )}

                  {checklist && checklist.length > 0 && (
                    <div className="space-y-2">
                      {checklist.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-2 text-xs dark:text-gray-200"
                        >
                          <label className="flex flex-1 items-start gap-2">
                            <Checkbox
                              checked={item.is_completed}
                              onCheckedChange={(value) =>
                                handleToggleItem(item, value === true)
                              }
                              className="mt-0.5 h-3.5 w-3.5"
                            />
                            <span>{item.label}</span>
                          </label>
                          {isJobLister && (
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              className="px-1 text-[10px] text-muted-foreground hover:text-destructive dark:text-gray-400 dark:hover:text-red-400"
                              onClick={async () => {
                                if (!numericJobId) return;
                                const confirmed = window.confirm(
                                  "Remove this task from the checklist?"
                                );
                                if (!confirmed) return;
                                setChecklist((prev) =>
                                  (prev ?? []).filter(
                                    (it) => it.id !== item.id
                                  )
                                );
                                const { error } = await supabase
                                  .from("job_checklist_items")
                                  .delete()
                                  .eq("id", item.id as never)
                                  .eq("job_id", numericJobId as never);
                                if (error) {
                                  setChecklistError(error.message);
                                }
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isJobLister && <ChecklistAdder onAdd={handleAddItem} />}

                  {isJobCleaner && checklist && checklist.length > 0 && (
                    <div className="pt-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="text-[10px]"
                        onClick={handleMarkAllComplete}
                      >
                        Mark all tasks as complete
                      </Button>
                    </div>
                  )}

                  {allCompleted && (
                    <p className="mt-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Congratulations! All tasks have been completed on the
                      checklist.
                    </p>
                  )}

                  {isJobCleaner && !hasAfterPhotos && (
                    <p className="pt-1 text-[11px] text-amber-700 dark:text-amber-300">
                      Upload at least 3 after-photos so the owner can review and
                      release payment.
                    </p>
                  )}
                </div>
              )}

              {(localJobStatus === "completed" ||
                localJobStatus === "completed_pending_approval") && (
                <>
                  <details className="rounded-md border bg-background/60 px-4 py-3 text-xs text-muted-foreground dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                    <summary className="cursor-pointer select-none text-sm font-medium text-foreground dark:text-gray-100">
                      Cleaning checklist history{" "}
                      {completedDateLabel
                        ? `(Completed ${completedDateLabel})`
                        : "(Completed)"}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {checklist &&
                        checklist.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-2 text-xs dark:text-gray-200"
                          >
                            <Checkbox
                              checked={item.is_completed}
                              className="mt-0.5 h-3.5 w-3.5"
                              disabled
                            />
                            <span>{item.label}</span>
                          </div>
                        ))}
                    </div>
                  </details>
                  <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    {localJobStatus === "completed"
                      ? "Payment has been released. Thanks for completing this bond clean through Bond Back."
                      : "Waiting on final approval and payment release…"}
                  </p>
                  {isJobLister && afterPhotoEntries.length > 0 && (
                    <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50/80 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/40">
                      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                        After photos from your cleaner
                      </p>
                      <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-200">
                        Review the after photos before you finalize and release funds.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {afterPhotoEntries.map((entry) => (
                          <div
                            key={entry.name}
                            className="h-20 w-24 overflow-hidden rounded-md border bg-muted/40 cursor-pointer dark:border-gray-700 dark:bg-gray-800/60 group"
                            onClick={() => setLightboxUrl(entry.url)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={entry.url}
                              alt="After clean"
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {isJobCleaner && (
                <div className="mt-4 space-y-2 rounded-md border bg-background/60 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium dark:text-gray-100">After photos</p>
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        Upload at least 3 photos showing the finished clean so the
                        owner can review before releasing funds. Max {PHOTO_LIMITS.JOB_AFTER} photos.
                      </p>
                    </div>
                  </div>
                  {afterPhotosLoading ? (
                    <p className="pt-1 text-xs text-muted-foreground dark:text-gray-400">
                      Loading photos…
                    </p>
                  ) : afterPhotoEntries.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {afterPhotoEntries.map((entry) => {
                        const canRemove = afterPhotoEntries.length > 3;
                        return (
                          <div
                            key={entry.name}
                            className="relative h-20 w-24 overflow-hidden rounded-md border border-border bg-muted/40 dark:border-gray-700 dark:bg-gray-800/60 cursor-pointer group"
                            onClick={() => setLightboxUrl(entry.url)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={entry.url}
                              alt="After clean"
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                            {canRemove && (
                              <button
                                type="button"
                                aria-label="Remove photo"
                                className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const path = `jobs/${numericJobId}/after/${entry.name}`;
                                  supabase.storage.from("condition-photos").remove([path]).then(({ error }) => {
                                    if (error) {
                                      toast({ variant: "destructive", title: "Remove failed", description: error.message });
                                    } else {
                                      setAfterPhotoEntries((prev) => prev.filter((p) => p.name !== entry.name));
                                    }
                                  });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      disabled={afterPhotosUploading || afterPhotoEntries.length >= PHOTO_LIMITS.JOB_AFTER}
                      asChild
                    >
                      <label className={afterPhotoEntries.length >= PHOTO_LIMITS.JOB_AFTER ? "cursor-not-allowed pointer-events-none" : "cursor-pointer"}>
                        <ImagePlus className="mr-1 h-3.5 w-3.5" />
                        <span>
                          {afterPhotosUploading
                            ? "Uploading…"
                            : "Upload / add photos"}
                        </span>
                        <input
                          type="file"
                          accept={PHOTO_VALIDATION.ACCEPT}
                          multiple
                          className="hidden"
                          onChange={async (event: ChangeEvent<HTMLInputElement>) => {
                            if (!numericJobId) return;
                            const files = event.target.files;
                            if (!files || files.length === 0) return;
                            const existingCount = afterPhotoEntries.length;
                            const { validFiles, errors } = validatePhotoFiles(Array.from(files), {
                              maxFiles: PHOTO_LIMITS.JOB_AFTER,
                              existingCount,
                            });
                            errors.forEach((err) => {
                              toast({
                                variant: "destructive",
                                title: "Photo validation",
                                description: err,
                              });
                            });
                            if (validFiles.length === 0) {
                              event.target.value = "";
                              return;
                            }
                            const withHeaderCheck: File[] = [];
                            for (const f of validFiles) {
                              const header = await checkImageHeader(f);
                              if (!header.valid) {
                                toast({
                                  variant: "destructive",
                                  title: "Photo validation",
                                  description: `${f.name}: ${header.error}`,
                                });
                                continue;
                              }
                              withHeaderCheck.push(f);
                            }
                            if (withHeaderCheck.length === 0) {
                              event.target.value = "";
                              return;
                            }
                            setAfterPhotosUploading(true);
                            try {
                              const fd = new FormData();
                              withHeaderCheck.forEach((f) => fd.append("files", f));
                              const { results, error: actionError } = await uploadProcessedPhotos(fd, {
                                bucket: "condition-photos",
                                pathPrefix: `jobs/${numericJobId}/after`,
                                maxFiles: PHOTO_LIMITS.JOB_AFTER,
                                existingCount,
                                generateThumb: true,
                              });
                              if (actionError) {
                                toast({ variant: "destructive", title: "Upload failed", description: actionError });
                              }
                              results.forEach((r) => {
                                if (r.error) {
                                  toast({
                                    variant: "destructive",
                                    title: "Upload failed",
                                    description: `${r.fileName}: ${r.error}`,
                                  });
                                }
                              });
                              const added = results.filter((r) => r.url).length;
                              if (added > 0) {
                                const { data, error: listError } = await supabase.storage
                                  .from("condition-photos")
                                  .list(`jobs/${numericJobId}/after`, { limit: 100 });
                                if (!listError && data) {
                                  const entries: AfterPhotoEntry[] = data
                                    .filter((file) => file.name && !file.name.startsWith("thumb_"))
                                    .map((file) => {
                                      const { data: { publicUrl } } = supabase.storage
                                        .from("condition-photos")
                                        .getPublicUrl(`jobs/${numericJobId}/after/${file.name}`);
                                      return { name: file.name, url: publicUrl };
                                    });
                                  setAfterPhotoEntries(entries);
                                }
                                toast({ title: "Photos added", description: `${added} photo(s) added.` });
                              }
                            } finally {
                              setAfterPhotosUploading(false);
                              event.target.value = "";
                            }
                          }}
                        />
                      </label>
                    </Button>
                    <span className="text-[11px] text-muted-foreground dark:text-gray-400">
                      {afterPhotoEntries.length}/{PHOTO_LIMITS.JOB_AFTER} photos
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
          {hasActiveJob &&
            isJobLister &&
            (localJobStatus === "in_progress" ||
              localJobStatus === "completed_pending_approval") &&
            !cleanerConfirmed && (
              <div className="space-y-2 rounded-md border bg-background/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-sm font-medium dark:text-gray-100">Approve &amp; Release Funds</p>
                {agreedAmountCents > 0 && (
                  <JobPaymentBreakdown
                    agreedAmountCents={agreedAmountCents}
                    feePercentage={feePercentage}
                    isStripeTestMode={isStripeTestMode}
                    variant="release"
                  />
                )}
                <p className="text-xs text-muted-foreground dark:text-gray-400">
                  Once the checklist and after-photos are done, you can release funds from escrow. After the cleaner marks complete, you&apos;ll have {autoReleaseHours} hours to approve or open a dispute.
                </p>
                {!hasAfterPhotos && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">Waiting for after photos…</p>
                )}
                {hasAfterPhotos && allCompleted && (
                  <Button type="button" size="sm" className="mt-2" disabled={isFinalizing} onClick={handleFinalizePayment}>
                    {isFinalizing ? "Releasing…" : "Approve & Release Funds"}
                  </Button>
                )}
              </div>
            )}

          {hasActiveJob &&
            isJobLister &&
            (localJobStatus === "in_progress" ||
              localJobStatus === "completed_pending_approval") &&
            cleanerConfirmed && (
              <div className="space-y-2 rounded-md border bg-background/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-sm font-medium dark:text-gray-100">Approve &amp; Release Funds</p>
                {agreedAmountCents > 0 && (
                  <JobPaymentBreakdown
                    agreedAmountCents={agreedAmountCents}
                    feePercentage={feePercentage}
                    isStripeTestMode={isStripeTestMode}
                    variant="release"
                  />
                )}
                {localJobStatus === "completed_pending_approval" &&
                  autoReleaseAt &&
                  autoReleaseMsLeft != null && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${autoReleaseBadgeClass}`}
                        >
                          Auto-release in {formatAutoReleaseCountdown(autoReleaseMsLeft)}
                        </Badge>
                        {autoReleaseMsLeft <= 0 && (
                          <span className="text-[11px] text-destructive dark:text-red-300">
                            Due now
                          </span>
                        )}
                      </div>
                      <Progress value={autoReleaseProgressValue} className="h-2" />
                    </div>
                  )}
                <p className="text-xs text-muted-foreground dark:text-gray-400">
                  The cleaner has marked the job complete. Review photos, then approve and release funds from escrow, or open a dispute with evidence.
                </p>
                {showListerFinalizeNotice && (
                  <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Payment has been released. The cleaner has been notified.
                    </span>
                  </div>
                )}
                {!showListerFinalizeNotice && (
                  <>
                    {!hasAfterPhotos && localJobStatus === "completed_pending_approval" && (
                      <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                        Waiting for after photos to release funds. You can still open a dispute within {autoReleaseHours} hours.
                      </p>
                    )}
                    {!hasAfterPhotos && localJobStatus === "in_progress" && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Waiting for after photos to be uploaded…
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {hasAfterPhotos && allCompleted && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={!allCompleted || !hasAfterPhotos || isFinalizing}
                          onClick={handleFinalizePayment}
                          className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                        >
                          {isFinalizing ? "Releasing…" : "Approve & Release Funds"}
                        </Button>
                      )}

                      {localJobStatus === "completed_pending_approval" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/50"
                          onClick={() => setShowOpenDisputeForm(true)}
                        >
                          Open Dispute
                        </Button>
                      )}
                    </div>
                    {showOpenDisputeForm && (
                      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                        <GuidedDisputeForm
                          jobId={numericJobId!}
                          jobPageHref={jobId ? `/jobs/${jobId}` : "/jobs"}
                          jobTitle={listing.title ?? undefined}
                          onCancel={() => setShowOpenDisputeForm(false)}
                          isLister={true}
                          agreedAmountCents={agreedAmountCents}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          {/* Reviews – show after job is completed (payment released) */}
          {hasActiveJob &&
            localJobStatus === "completed" &&
            canLeaveReview &&
            numericJobId && (
            <div className="space-y-4 rounded-md border border-border bg-muted/30 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
              <div>
                <p className="text-sm font-medium dark:text-gray-100">Leave a review</p>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                  Rate your experience. One review per job — helps others choose with confidence.
                </p>
              </div>
              {isJobLister && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground dark:text-gray-100">
                    Your review of the cleaner
                  </p>
                  {(hasReviewedCleaner || submittedCleanerReview) ? (
                    <p className="flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      You&apos;ve left your review. Thanks for your feedback.
                    </p>
                  ) : (
                    <>
                      {!showCleanerReviewForm && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setShowCleanerReviewForm(true)}
                        >
                          Leave Review
                        </Button>
                      )}
                      {showCleanerReviewForm && (
                        <ReviewForm
                          jobId={numericJobId}
                          revieweeType="cleaner"
                          onSuccess={() => setSubmittedCleanerReview(true)}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
              {isJobCleaner && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground dark:text-gray-100">
                    Your review of the owner
                  </p>
                  {(hasReviewedLister || submittedListerReview) ? (
                    <p className="flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      You&apos;ve left your review. Thanks for your feedback.
                    </p>
                  ) : (
                    <>
                      {!showListerReviewForm && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setShowListerReviewForm(true)}
                        >
                          Leave Review
                        </Button>
                      )}
                      {showListerReviewForm && (
                        <ReviewForm
                          jobId={numericJobId}
                          revieweeType="lister"
                          onSuccess={() => setSubmittedListerReview(true)}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Disputed: Respond to Dispute (cleaner when lister opened, or lister when cleaner opened) */}
          {hasActiveJob &&
            numericJobId &&
            (localJobStatus === "disputed" || localJobStatus === "in_review") &&
            (isJobLister || isJobCleaner) && (
              <div id="dispute" className="scroll-mt-6 space-y-3 rounded-md border border-amber-200 bg-amber-50/50 px-4 py-4 dark:border-amber-800/60 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Dispute opened – {disputeOpenedBy === "lister" ? "cleaner" : "lister"} can respond with evidence
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Respond with your side, photos and a message. You can also accept a mutual resolution below.
                </p>
                {/* Responder: show form if they haven't responded yet */}
                {((disputeOpenedBy === "lister" && isJobCleaner) || (disputeOpenedBy === "cleaner" && isJobLister)) &&
                  !hasDisputeResponse &&
                  !responseSubmitted && (
                    <div className="mt-3 space-y-3 rounded border border-amber-300/60 bg-white/60 p-3 dark:border-amber-700 dark:bg-amber-950/40">
                      <Label>Your response</Label>
                      <Select value={disputeResponseReason} onValueChange={setDisputeResponseReason}>
                        <SelectTrigger className="dark:bg-gray-800">
                          <SelectValue placeholder="Counter-reason…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quality">Quality</SelectItem>
                          <SelectItem value="timeliness">Timeliness</SelectItem>
                          <SelectItem value="damage">Damage</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea
                        placeholder="Message to the other party (optional)"
                        value={disputeResponseMessage}
                        onChange={(e) => setDisputeResponseMessage(e.target.value)}
                        rows={2}
                        className="dark:bg-gray-800"
                      />
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <label className="flex cursor-pointer items-center gap-1">
                            <ImagePlus className="h-4 w-4" />
                            Add evidence photos
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const files = e.target.files ? Array.from(e.target.files).slice(0, 5) : [];
                                setDisputeResponsePhotos(files);
                              }}
                            />
                          </label>
                        </Button>
                        {disputeResponsePhotos.length > 0 && (
                          <span className="text-xs text-muted-foreground">{disputeResponsePhotos.length} photo(s)</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!disputeResponseReason || disputeResponsePhotos.length === 0 || isSubmittingResponse}
                        onClick={() => {
                          startSubmitResponse(async () => {
                            let urls: string[] = [];
                            if (disputeResponsePhotos.length > 0) {
                              const fd = new FormData();
                              disputeResponsePhotos.forEach((f) => fd.append("file", f));
                              const { results, error } = await uploadProcessedPhotos(fd, {
                                bucket: "condition-photos",
                                pathPrefix: `disputes/${numericJobId}/response`,
                                maxFiles: 5,
                                generateThumb: true,
                              });
                              urls = (results ?? []).map((r) => r?.url).filter(Boolean) as string[];
                              if (error && urls.length === 0) {
                                toast({ variant: "destructive", title: "Upload failed", description: error });
                                return;
                              }
                            }
                            const res = await respondToDispute(numericJobId, {
                              reason: disputeResponseReason,
                              photoUrls: urls,
                              message: disputeResponseMessage.trim() || undefined,
                            });
                            if (res.ok) {
                              setResponseSubmitted(true);
                              toast({ title: "Response submitted", description: "The other party has been notified." });
                            } else {
                              toast({ variant: "destructive", title: "Failed", description: res.error });
                            }
                          });
                        }}
                      >
                        {isSubmittingResponse ? "Submitting…" : "Submit response"}
                      </Button>
                    </div>
                  )}
                {(hasDisputeResponse || responseSubmitted) && (
                  <p className="text-xs text-amber-800 dark:text-amber-200">Response submitted. Waiting for resolution or admin review.</p>
                )}
                {/* Accept Resolution – both parties */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-200"
                  disabled={isAcceptingResolution}
                  onClick={() => {
                    startAcceptResolution(async () => {
                      const res = await acceptResolution(numericJobId);
                      if (res.ok) {
                        setLocalJobStatus("completed");
                        toast({ title: "Resolution accepted", description: "Dispute closed by mutual agreement." });
                      } else {
                        toast({ variant: "destructive", title: "Failed", description: res.error });
                      }
                    });
                  }}
                >
                  {isAcceptingResolution ? "Accepting…" : "Accept Resolution (mutual agreement)"}
                </Button>
              </div>
            )}

          {/* Refund negotiation: lister proposed partial refund, cleaner can Accept / Counter / Reject */}
          {hasActiveJob &&
            numericJobId &&
            (localJobStatus === "dispute_negotiating" ||
              localJobStatus === "disputed") &&
            (isJobLister || isJobCleaner) && (
              <div className="space-y-4 rounded-md border border-amber-200 bg-amber-50/50 px-4 py-4 dark:border-amber-800/60 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Partial refund offer
                </p>
                <p className="text-base font-semibold text-foreground dark:text-gray-100">
                  {proposedRefundAmount && proposedRefundAmount > 0
                    ? `Lister offers partial refund: ${formatCents(proposedRefundAmount)}`
                    : "No partial refund amount proposed yet (cleaner can counter)."}
                </p>

                {isJobCleaner && (
                  <>
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Accept the amount, propose a different amount, or reject to escalate to review.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {proposedRefundAmount && proposedRefundAmount > 0 && (
                        <Button
                          size="lg"
                          className="min-h-[48px] w-full flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                          disabled={isAcceptingRefund}
                          onClick={() => {
                            startAcceptRefund(async () => {
                              const res = await acceptRefund(numericJobId);
                              if (res.ok) {
                                setLocalJobStatus("completed");
                                toast({ title: "Refund accepted", description: "Funds have been released." });
                              } else {
                                toast({ variant: "destructive", title: "Failed", description: res.error });
                              }
                            });
                          }}
                        >
                          {isAcceptingRefund ? "Accepting…" : "Accept Refund"}
                        </Button>
                      )}

                      <Dialog open={showCounterDialog} onOpenChange={setShowCounterDialog}>
                        <DialogTrigger asChild>
                          <Button
                            size="lg"
                            variant="outline"
                            className="min-h-[48px] w-full flex-1 border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900/70"
                            onClick={() => setCounterAmountCents(proposedRefundAmount ?? 0)}
                          >
                            Counter
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md dark:border-gray-700 dark:bg-gray-900">
                          <DialogHeader>
                            <DialogTitle>Propose a different amount</DialogTitle>
                            <DialogDescription>
                              Suggest a refund amount. The lister can accept or respond.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <Label>Your counter (refund amount)</Label>
                            <Slider
                              value={[counterAmountCents]}
                              onValueChange={([v]) => {
                                // v can be undefined from Slider onValueChange
                                if (v !== undefined) setCounterAmountCents(v);
                              }}
                              min={0}
                              max={agreedAmountCents || 1}
                              step={500}
                              className="w-full"
                            />
                            <p className="text-sm font-medium">{formatCents(counterAmountCents)}</p>
                            <Label htmlFor="counter-msg">Message (optional)</Label>
                            <Textarea
                              id="counter-msg"
                              placeholder="Add a note…"
                              value={counterMessage}
                              onChange={(e) => setCounterMessage(e.target.value)}
                              rows={2}
                              className="dark:bg-gray-800"
                            />
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCounterDialog(false)}>
                              Cancel
                            </Button>
                            <Button
                              disabled={isCounteringRefund}
                              onClick={() => {
                                startCounteringRefund(async () => {
                                  const res = await counterRefund(numericJobId, {
                                    amountCents: counterAmountCents,
                                    message: counterMessage.trim() || undefined,
                                  });
                                  if (res.ok) {
                                    setShowCounterDialog(false);
                                    toast({ title: "Counter sent", description: "The lister has been notified." });
                                  } else {
                                    toast({ variant: "destructive", title: "Failed", description: res.error });
                                  }
                                });
                              }}
                            >
                              {isCounteringRefund ? "Sending…" : "Send counter"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                        <DialogTrigger asChild>
                          <Button
                            size="lg"
                            variant="destructive"
                            className="min-h-[48px] w-full flex-1"
                            disabled={isRejectingRefund}
                          >
                            {isRejectingRefund ? "Rejecting…" : "Reject"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="dark:border-gray-700 dark:bg-gray-900">
                          <DialogHeader>
                            <DialogTitle>Reject refund offer?</DialogTitle>
                            <DialogDescription>
                              The dispute will be escalated for admin review. You can still respond with evidence.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
                            <Button
                              variant="destructive"
                              disabled={isRejectingRefund}
                              onClick={() => {
                                startRejectingRefund(async () => {
                                  const res = await rejectRefund(numericJobId);
                                  if (res.ok) {
                                    setLocalJobStatus("in_review");
                                    setShowRejectDialog(false);
                                    toast({ title: "Escalated", description: "Dispute has been sent for review." });
                                  } else {
                                    toast({ variant: "destructive", title: "Failed", description: res.error });
                                  }
                                });
                              }}
                            >
                              {isRejectingRefund ? "Rejecting…" : "Reject & escalate"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </>
                )}

                {isJobLister && (
                  <>
                    {counterProposalAmount != null && counterProposalAmount > 0 ? (
                      <div className="space-y-2 rounded border border-amber-300/60 bg-white/60 p-3 dark:border-amber-700 dark:bg-amber-950/40">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          Cleaner countered with: {formatCents(counterProposalAmount)}
                        </p>
                        <Button
                          size="lg"
                          className="min-h-[48px] bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                          disabled={isAcceptingCounter}
                          onClick={() => {
                            startAcceptCounter(async () => {
                              const res = await acceptCounterRefund(numericJobId);
                              if (res.ok) {
                                setLocalJobStatus("completed");
                                toast({ title: "Counter accepted", description: "Job completed." });
                              } else {
                                toast({ variant: "destructive", title: "Failed", description: res.error });
                              }
                            });
                          }}
                        >
                          {isAcceptingCounter ? "Accepting…" : "Accept counter"}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        Waiting for the cleaner to accept, counter, or reject your offer.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

          {/* Raise a dispute – completed jobs only, lister or cleaner (not when already disputed) */}
          {hasActiveJob &&
            localJobStatus === "completed" &&
            numericJobId &&
            (isJobLister || isJobCleaner) && (
              <details
                open={showRaiseDisputeForm}
                onToggle={(e) =>
                  setShowRaiseDisputeForm(
                    (e.currentTarget as HTMLDetailsElement).open
                  )
                }
                className="rounded-md border border-amber-200 bg-amber-50/50 px-4 py-4 dark:border-amber-800/60 dark:bg-amber-950/30"
              >
                <summary className="cursor-pointer select-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Something wrong? Raise a dispute
                      </p>
                      <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
                        If the outcome wasn’t as agreed, you can open a dispute. We’ll review both sides and your funds stay protected.
                      </p>
                    </div>
                    {!showRaiseDisputeForm && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-200 hover:bg-amber-50"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowRaiseDisputeForm(true);
                        }}
                      >
                        Open a dispute
                      </Button>
                    )}
                  </div>
                </summary>

                {showRaiseDisputeForm && (
                  <div className="mt-4">
                    <GuidedDisputeForm
                      jobId={numericJobId}
                      jobPageHref={jobId ? `/jobs/${jobId}` : "/jobs"}
                      jobTitle={listing.title ?? undefined}
                      isLister={isJobLister}
                      agreedAmountCents={agreedAmountCents}
                      onCancel={() => setShowRaiseDisputeForm(false)}
                    />
                  </div>
                )}
              </details>
            )}

          {listing.special_instructions && (
            <div>
              <p className="text-xs font-medium text-muted-foreground dark:text-gray-300">Special instructions</p>
              <p className="text-sm dark:text-gray-200">{listing.special_instructions}</p>
            </div>
          )}
          {listing.addons && Array.isArray(listing.addons) && listing.addons.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground dark:text-gray-300">Add-ons included</p>
              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                {listing.addons.map((addon) => (
                  <span
                    key={addon}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 dark:bg-gray-700/60 dark:text-gray-200"
                  >
                    <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    <span className="capitalize">
                      {addon.replace(/_/g, " ")}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {(() => {
            const rawPreferred =
              ((listing as any).preferred_dates as string[] | null) ?? null;
            const dates: Date[] =
              rawPreferred && rawPreferred.length > 0
                ? rawPreferred.map((d) => new Date(d))
                : listing.move_out_date
                  ? [new Date(listing.move_out_date)]
                  : [];

            return (
              <div className="space-y-2">
                {dates.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                      Preferred cleaning dates
                    </p>
                    <ul className="mt-1 space-y-0.5 text-sm dark:text-gray-200">
                      {dates.map((d) => (
                        <li key={d.toISOString()}>
                          {format(d, "EEEE, MMMM 'the' do yyyy")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                  <p className="text-xs font-semibold text-sky-900 dark:text-gray-100">
                    Initial property photos (condition before bond clean)
                  </p>
                  {initialPhotosLoading ? (
                    <p className="mt-2 text-xs text-muted-foreground dark:text-gray-400">
                      Loading photos…
                    </p>
                  ) : (() => {
                    const rawInitial = (listing as ListingRow & { initial_photos?: string[] | null }).initial_photos;
                    const dbInitial = Array.isArray(rawInitial) ? rawInitial : [];
                    const photoUrls = (Array.isArray(listing.photo_urls) ? listing.photo_urls : []) as string[];
                    const fromStorage = initialPhotoEntries.length > 0;
                    const displayEntries = fromStorage
                      ? initialPhotoEntries
                      : (dbInitial.length > 0 ? dbInitial : photoUrls).map((url, i) => ({ name: `fallback-${i}`, url }));
                    const canEditInitialPhotos = (isJobLister || isListingOwner) && !isCleaner;
                    const canRemove = canEditInitialPhotos && fromStorage && initialPhotoEntries.length > 3;
                    return displayEntries.length > 0 ? (
                    <>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {displayEntries.map((entry, idx) => {
                            const isDefault = (listing as ListingRow & { cover_photo_url?: string | null }).cover_photo_url === entry.url;
                            return (
                          <div
                            key={fromStorage ? entry.name : `fallback-${idx}`}
                            className="relative h-20 w-24 overflow-hidden rounded-md border border-border bg-muted/40 dark:border-gray-700 dark:bg-gray-800/60 cursor-pointer group"
                            onClick={() => setLightboxUrl(entry.url)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={entry.url}
                              alt="Property"
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                            {isDefault && (
                              <span className="absolute left-0.5 top-0.5 z-10 rounded px-1 py-0.5 text-[9px] font-medium bg-emerald-600 text-white">
                                Default
                              </span>
                            )}
                            {canEditInitialPhotos && !entry.name.startsWith("fallback-") && (
                              <button
                                type="button"
                                aria-label="Set as default photo"
                                className="absolute bottom-0.5 left-0.5 right-0.5 z-10 flex items-center justify-center gap-0.5 rounded py-0.5 text-[9px] font-medium bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  import("@/lib/actions/listings").then(({ updateListingCoverPhoto }) => {
                                    updateListingCoverPhoto(listingId, entry.url).then((res) => {
                                      if (res.ok) {
                                        setListing((prev) => ({ ...prev, cover_photo_url: entry.url } as ListingRow));
                                        toast({ title: "Default photo set", description: "This photo will show on listing cards." });
                                      } else {
                                        toast({ variant: "destructive", title: "Failed", description: res.error });
                                      }
                                    });
                                  });
                                }}
                              >
                                <ImageIcon className="h-2.5 w-2.5" />
                                Set as default
                              </button>
                            )}
                            {canRemove && !entry.name.startsWith("fallback-") && (
                              <button
                                type="button"
                                aria-label="Remove photo"
                                className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const path = `listings/${listingId}/initial/${entry.name}`;
                                  supabase.storage.from("condition-photos").remove([path]).then(({ error }) => {
                                    if (error) {
                                      toast({ variant: "destructive", title: "Remove failed", description: error.message });
                                    } else {
                                      setInitialPhotoEntries((prev) => prev.filter((p) => p.name !== entry.name));
                                    }
                                  });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                            );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <div
                            key={idx}
                            className="h-20 w-24 rounded-md border border-dashed border-sky-200 bg-sky-100/60 dark:border-gray-600 dark:bg-gray-800/50"
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-sky-800 dark:text-gray-300">
                        No photos uploaded yet. Minimum 3 photos required before
                        starting the job.
                      </p>
                    </div>
                  );
                  })()}
                  {(isJobLister || isListingOwner) && !isCleaner && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        disabled={initialPhotosUploading || initialPhotoEntries.length >= PHOTO_LIMITS.LISTING_INITIAL}
                        asChild
                      >
                        <label className={initialPhotoEntries.length >= PHOTO_LIMITS.LISTING_INITIAL ? "cursor-not-allowed pointer-events-none" : "cursor-pointer"}>
                          <ImagePlus className="mr-1 h-3.5 w-3.5" />
                          <span>
                            {initialPhotosUploading
                              ? "Uploading…"
                              : "Upload / add photos"}
                          </span>
                          <input
                            type="file"
                            accept={PHOTO_VALIDATION.ACCEPT}
                            multiple
                            className="hidden"
                            onChange={async (event: ChangeEvent<HTMLInputElement>) => {
                              if (!listing.id) return;
                              const files = event.target.files;
                              if (!files || files.length === 0) return;
                              const existingCount = initialPhotoEntries.length;
                              const { validFiles, errors } = validatePhotoFiles(Array.from(files), {
                                maxFiles: PHOTO_LIMITS.LISTING_INITIAL,
                                existingCount,
                              });
                              errors.forEach((err) => {
                                toast({
                                  variant: "destructive",
                                  title: "Photo validation",
                                  description: err,
                                });
                              });
                              if (validFiles.length === 0) {
                                event.target.value = "";
                                return;
                              }
                              const withHeaderCheck: File[] = [];
                              for (const f of validFiles) {
                                const header = await checkImageHeader(f);
                                if (!header.valid) {
                                  toast({
                                    variant: "destructive",
                                    title: "Photo validation",
                                    description: `${f.name}: ${header.error}`,
                                  });
                                  continue;
                                }
                                withHeaderCheck.push(f);
                              }
                              if (withHeaderCheck.length === 0) {
                                event.target.value = "";
                                return;
                              }
                              setInitialPhotosUploading(true);
                              try {
                                const fd = new FormData();
                                withHeaderCheck.forEach((f) => fd.append("files", f));
                                const pathPrefix = `listings/${listingId}/initial`;
                                const { results, error: actionError } = await uploadProcessedPhotos(fd, {
                                  bucket: "condition-photos",
                                  pathPrefix,
                                  maxFiles: PHOTO_LIMITS.LISTING_INITIAL,
                                  existingCount,
                                  generateThumb: true,
                                });
                                if (actionError) {
                                  toast({ variant: "destructive", title: "Upload failed", description: actionError });
                                }
                                results.forEach((r) => {
                                  if (r.error) {
                                    toast({
                                      variant: "destructive",
                                      title: "Upload failed",
                                      description: `${r.fileName}: ${r.error}`,
                                    });
                                  }
                                });
                                const added = results.filter((r) => r.url).length;
                                if (added > 0) {
                                  const { data, error: listError } = await supabase.storage
                                    .from("condition-photos")
                                    .list(`listings/${listingId}/initial`, { limit: 100 });
                                  if (!listError && data) {
                                    const entries: InitialPhotoEntry[] = data
                                      .filter((file) => file.name && !file.name.startsWith("thumb_"))
                                      .map((file) => {
                                        const { data: { publicUrl } } = supabase.storage
                                          .from("condition-photos")
                                          .getPublicUrl(`listings/${listingId}/initial/${file.name}`);
                                        return { name: file.name, url: publicUrl };
                                      });
                                    setInitialPhotoEntries(entries);
                                  }
                                  toast({ title: "Photos added", description: `${added} photo(s) added.` });
                                }
                              } finally {
                                setInitialPhotosUploading(false);
                                event.target.value = "";
                              }
                            }}
                          />
                        </label>
                      </Button>
                      <span className="text-[11px] text-muted-foreground dark:text-gray-400">
                        {initialPhotoEntries.length}/{PHOTO_LIMITS.LISTING_INITIAL} photos
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {showAuctionActions && (
        <Card>
          <CardHeader>
            <CardTitle>Place a lower bid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1">
                <PlaceBidForm
                  listingId={listingId}
                  listing={listing}
                  isCleaner={isCleaner}
                  currentUserId={currentUserId}
                />
              </div>
              {isCleaner && (
                <div className="flex flex-row flex-wrap gap-2 sm:ml-4">
                  {listing.buy_now_cents != null &&
                    listing.buy_now_cents > 0 &&
                    listing.current_lowest_bid_cents >= listing.buy_now_cents && (
                      <BuyNowButton
                        listingId={listingId}
                        buyNowCents={listing.buy_now_cents}
                        disabled={!isLive}
                        currentUserId={currentUserId}
                      />
                    )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 animate-in fade-in-0 duration-200"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged photo"
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute -right-2 -top-2 rounded-full bg-black/80 px-2 py-1 text-xs text-white hover:bg-black"
              onClick={() => setLightboxUrl(null)}
            >
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Photo full size"
              className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}

type ChecklistAdderProps = {
  onAdd: (label: string) => Promise<void> | void;
};

function ChecklistAdder({ onAdd }: ChecklistAdderProps) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await onAdd(trimmed);
      setValue("");
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add another task (e.g. windows, garage)…"
        className="flex-1 rounded-md border bg-background px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || !value.trim()}
        onClick={handleSubmit}
        className="text-xs"
      >
        {pending ? "Adding…" : "Add task"}
      </Button>
    </div>
  );
}
