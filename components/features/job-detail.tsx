"use client";

import { useEffect, useState, useTransition, useCallback, useMemo, type ChangeEvent } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { CountdownTimer } from "@/components/features/countdown-timer";
import { BidHistoryTable } from "@/components/features/bid-history-table";
import { PlaceBidForm } from "@/components/features/place-bid-form";
import { BuyNowButton } from "@/components/features/buy-now-button";
import { formatCents } from "@/lib/listings";
import { parseUtcTimestamp, cn } from "@/lib/utils";
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
import Image from "next/image";
import { ImagePlus, CheckCircle2, Star, MapPin, X, ImageIcon } from "lucide-react";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { ReviewForm } from "@/components/features/review-form";
import { GuidedDisputeForm } from "@/components/features/guided-dispute-form";
import { useToast } from "@/components/ui/use-toast";
import { useIsOffline } from "@/hooks/use-offline";
import {
  respondToDispute,
  acceptResolution,
  acceptRefund,
  counterRefund,
  rejectRefund,
  acceptCounterRefund,
  acceptBid,
  extendListerReview24h,
} from "@/lib/actions/jobs";
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

/** Some mobile/gallery pickers repeat files in a multi-select; dedupe by stable identity. */
function dedupeImageFiles(files: File[]): File[] {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const f of files) {
    const k = `${f.name}\0${f.size}\0${f.lastModified}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

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
  /** True when the current user owns the listing and is viewing as lister (active role). Not true in cleaner role even for own listings. */
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
  /** Set when the lister used the one-time 24h extension (server column). */
  reviewExtensionUsedAt?: string | null;
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
  reviewExtensionUsedAt = null,
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
  const [showCancelListingDialog, setShowCancelListingDialog] = useState(false);
  const [cancellingListing, setCancellingListing] = useState(false);
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
  const [requestingPayment, setRequestingPayment] = useState(false);
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
  const [isExtendingReview, startExtendReview] = useTransition();
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

  /** Platform fee on current lowest bid amount (lister view; updates with listing realtime). */
  const platformFeeOnCurrentBidCents = useMemo(() => {
    const jobCents = Number(listing.current_lowest_bid_cents ?? 0);
    if (!Number.isFinite(jobCents) || jobCents <= 0 || !Number.isFinite(feePercentage)) return 0;
    return Math.round((jobCents * feePercentage) / 100);
  }, [listing.current_lowest_bid_cents, feePercentage]);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [paymentSuccessToastShown, setPaymentSuccessToastShown] = useState(false);

  /** Lister menu / card: ?cancel=1 opens “cancel listing early” (auction still live, no job yet). */
  useEffect(() => {
    if (searchParams.get("cancel") !== "1") return;
    const stillLive =
      listing.status === "live" && parseUtcTimestamp(listing.end_time) > Date.now();
    if (isListingOwner && !hasActiveJob && stillLive) {
      setShowCancelListingDialog(true);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cancel");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    searchParams,
    pathname,
    router,
    isListingOwner,
    hasActiveJob,
    listing.status,
    listing.end_time,
  ]);

  /** Mobile /jobs list swipe “Quick bid” → scroll to bid form; strip query after. */
  useEffect(() => {
    if (searchParams.get("quickBid") !== "1") return;
    const scrollToBid = () =>
      document.getElementById("place-bid")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    requestAnimationFrame(scrollToBid);
    const t = window.setTimeout(scrollToBid, 350);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("quickBid");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    return () => window.clearTimeout(t);
  }, [searchParams, pathname, router]);

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

  const handleCleanCompleteRequestPayment = () => {
    if (!jobId || !isJobCleaner) return;
    if (isOffline) {
      toast({ title: "Offline", description: "Reconnect to perform this action.", variant: "destructive" });
      return;
    }
    if (!allCompleted || !hasAfterPhotos) return;
    setRequestingPayment(true);
    void (async () => {
      try {
        const { markJobChecklistFinished } = await import("@/lib/actions/jobs");
        const res = await markJobChecklistFinished(jobId);
        if (!res.ok) {
          toast({
            variant: "destructive",
            title: "Could not request payment",
            description: res.error ?? "Please try again.",
          });
          return;
        }
        setLocalJobStatus("completed_pending_approval");
        setCleanerConfirmed(true);
        setConfirmedAt(new Date().toISOString());
        toast({
          title: "Lister notified",
          description: "They can review your work and release payment. The review timer has started.",
        });
        router.refresh();
      } finally {
        setRequestingPayment(false);
      }
    })();
  };

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

  const canExtendListerReview =
    isJobLister &&
    localJobStatus === "completed_pending_approval" &&
    !!autoReleaseAt?.trim() &&
    !reviewExtensionUsedAt;

  /** Larger type, spacing, and highlighted panels for cleaner or lister job-detail views. */
  const listerDetailUI = !isCleaner && (isListingOwner || isJobLister);
  const detailUiBoost = isCleaner || listerDetailUI;
  /** Checklist is used by both parties during in-progress — match touch targets for both. */
  const checklistParty = isJobCleaner || isJobLister;

  /** Cleaner has submitted "Clean Complete — Request Payment"; simplify job card until lister acts. */
  const cleanerReviewPendingMinimal =
    isJobCleaner &&
    cleanerConfirmed &&
    localJobStatus === "completed_pending_approval";

  /** Lister is on Approve & Release Funds (review after cleaner requested payment). */
  const listerReleaseFundsStep =
    isJobLister && localJobStatus === "completed_pending_approval";

  return (
    <div className={cn("space-y-6", detailUiBoost && "pb-24 md:pb-10")}>
      {paymentTimeline && (
        <JobPaymentTimeline {...paymentTimeline} />
      )}
      <Card
        className={cn(
          detailUiBoost &&
            "overflow-hidden rounded-2xl border-border/90 shadow-md ring-1 ring-border/50 dark:border-gray-800 dark:ring-gray-800/50"
        )}
      >
        <CardHeader
          className={cn(
            "space-y-3",
            detailUiBoost && "space-y-4 px-4 pt-2 sm:px-6 sm:pt-4"
          )}
        >
          {isListingOwner && !hasActiveJob && isLive && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-red-300 text-red-800 hover:bg-red-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
                onClick={() => setShowCancelListingDialog(true)}
              >
                Cancel listing
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle
              className={cn(
                "text-xl dark:text-gray-100",
                detailUiBoost &&
                  "text-2xl font-bold leading-tight tracking-tight sm:text-3xl"
              )}
            >
              {listing.title}
            </CardTitle>
            {!isSold && !hideCleanerCancelledAuctionUi && (
              <CountdownTimer
                endTime={listing.end_time}
                className={cn(
                  "font-medium",
                  detailUiBoost ? "text-base font-semibold sm:text-lg" : "text-sm"
                )}
                expiredLabel="Auction ended"
              />
            )}
          </div>
          <p
            className={cn(
              "flex items-center gap-2 text-muted-foreground dark:text-gray-400",
              detailUiBoost ? "text-base sm:text-lg" : "text-sm"
            )}
          >
            <MapPin
              className={cn("shrink-0", detailUiBoost ? "h-5 w-5" : "h-4 w-4")}
              aria-hidden
            />
            <span
              className={cn(
                listerReleaseFundsStep && propertyAddress?.trim() && "flex flex-col gap-0.5"
              )}
            >
              {listerReleaseFundsStep && propertyAddress?.trim() ? (
                <>
                  <span className="text-foreground dark:text-gray-100">
                    {propertyAddress.trim()}
                  </span>
                  <span>{formatLocationWithState(listing.suburb, listing.postcode)}</span>
                </>
              ) : isJobCleaner && propertyAddress?.trim() ? (
                propertyAddress.trim()
              ) : (
                formatLocationWithState(listing.suburb, listing.postcode)
              )}
            </span>
          </p>
        </CardHeader>
        <CardContent
          className={cn("space-y-4", detailUiBoost && "space-y-5 px-4 sm:px-6")}
        >
          {hasActiveJob && (listerName || cleanerName) && (
            <div
              className={cn(
                "border-b border-border pb-3 text-muted-foreground dark:border-gray-700 dark:text-gray-400",
                detailUiBoost ? "text-sm leading-relaxed" : "text-[11px]"
              )}
            >
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
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
                detailUiBoost ? "py-3 text-base font-semibold" : "text-sm"
              )}
            >
              <span className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden />
              <span className="font-medium">
                This listing is currently live and has bids
              </span>
            </div>
          )}
          {isListingOwner && !hasActiveJob && isLive && bids.length === 0 && (
            <div
              className={cn(
                "rounded-xl border border-sky-200/70 bg-sky-50/60 px-4 py-3 shadow-sm dark:border-sky-900/50 dark:bg-sky-950/35",
                listerDetailUI && "rounded-2xl border-2 px-5 py-4"
              )}
            >
              <p
                className={cn(
                  "font-semibold uppercase tracking-wide text-sky-700/90 dark:text-sky-400/90",
                  listerDetailUI ? "text-xs sm:text-sm" : "text-[11px]"
                )}
              >
                Status
              </p>
              <p
                className={cn(
                  "mt-1 font-medium leading-snug text-sky-900 dark:text-sky-100",
                  listerDetailUI ? "text-lg sm:text-xl" : "text-sm"
                )}
              >
                Live &amp; Waiting for Cleaner Bids
              </p>
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
            <div
              className={cn(
                "space-y-2 rounded-xl border border-border bg-muted/40 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50",
                detailUiBoost && "text-sm ring-1 ring-border/60 dark:ring-gray-700/80"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className={cn(
                    "font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-300",
                    detailUiBoost && "text-xs sm:text-sm"
                  )}
                >
                  Job progress
                </p>
                {localJobStatus === "accepted" && hasPaymentHold && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                    Payment held in escrow
                  </span>
                )}
                {localJobStatus === "in_progress" && (
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                    Awaiting cleaner completion and request payment
                  </span>
                )}
                {localJobStatus === "completed_pending_approval" && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                    Awaiting property lister completion
                  </span>
                )}
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
                    className={cn(
                      "flex items-center gap-1.5",
                      detailUiBoost ? "text-xs sm:text-sm" : "text-[11px]"
                    )}
                  >
                    {step.done ? (
                      <CheckCircle2
                        className={cn(
                          "text-emerald-600",
                          detailUiBoost ? "h-4 w-4" : "h-3 w-3"
                        )}
                      />
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
            isJobCleaner &&
            !cleanerReviewPendingMinimal && (
              <div className="space-y-2 rounded-2xl border-2 border-sky-400/50 bg-gradient-to-br from-sky-50 to-transparent px-4 py-4 dark:border-sky-700 dark:from-sky-950/50 sm:px-5">
                <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-sky-900 dark:text-sky-100">
                  <MapPin className="h-5 w-5 shrink-0" />
                  <span>Property address</span>
                </p>
                <p className="text-lg font-semibold leading-snug text-sky-950 dark:text-sky-50 sm:text-xl">
                  {propertyAddress && propertyAddress.trim().length > 0
                    ? propertyAddress
                    : formatLocationWithState(listing.suburb, listing.postcode)}
                </p>
                <p className="text-sm leading-relaxed text-sky-900 dark:text-sky-200">
                  This is the location for this bond clean job. Use it for your
                  maps and travel planning.
                </p>
              </div>
            )}

          {hasActiveJob &&
            isJobCleaner &&
            localJobStatus === "completed_pending_approval" &&
            !cleanerReviewPendingMinimal && (
              <div className="rounded-2xl border border-amber-400/70 bg-gradient-to-br from-amber-50 to-amber-100/40 px-4 py-4 dark:border-amber-800/60 dark:from-amber-950/50 dark:to-amber-900/20 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-amber-950 dark:text-amber-100">
                      Lister review window
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-amber-900/95 dark:text-amber-200/95">
                      {autoReleaseAt && autoReleaseMsLeft != null
                        ? `If the lister doesn't approve or raise a dispute, your payment auto-releases when this timer hits zero.`
                        : `Auto-release is paused (e.g. dispute open or admin hold). You'll be notified when the review timer resumes.`}
                    </p>
                  </div>
                  {autoReleaseAt && autoReleaseMsLeft != null ? (
                    <Badge
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums",
                        autoReleaseBadgeClass
                      )}
                    >
                      {autoReleaseMsLeft <= 0
                        ? "Auto-release now"
                        : `Auto-release in ${formatAutoReleaseCountdown(autoReleaseMsLeft)}`}
                    </Badge>
                  ) : (
                    <Badge className="shrink-0 rounded-full border-amber-300 bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
                      Paused
                    </Badge>
                  )}
                </div>
                {autoReleaseAt && autoReleaseMsLeft != null && autoReleaseMsLeft > 0 && (
                  <Progress value={autoReleaseProgressValue} className="mt-3 h-2.5" />
                )}
              </div>
            )}

          {isSold ? (
            <>
              {localJobStatus === "completed" ? (
                <>
                  {isJobLister && (
                    <>
                      <div className="space-y-3 rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-4 py-4 dark:border-emerald-700 dark:from-emerald-950/40 dark:to-emerald-900/30 sm:px-5">
                        <p className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                          Payment released
                        </p>
                        <p className="text-xl font-semibold leading-snug text-emerald-900 sm:text-2xl dark:text-emerald-100">
                          {`Congratulations! Your payment of ${formatCents(
                            agreedAmountCents
                          )} has been paid to ${
                            cleanerName
                              ? cleanerName.split(" ")[0]
                              : "your cleaner"
                          }.`}
                        </p>
                      </div>
                      <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                        <div className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400">
                          <Star className="h-4 w-4 fill-amber-400 dark:fill-amber-500" />
                          <Star className="h-4 w-4 fill-amber-400 dark:fill-amber-500" />
                          <Star className="h-4 w-4 fill-amber-400 dark:fill-amber-500" />
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
                      <div className="space-y-3 rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-4 py-4 dark:border-emerald-700 dark:from-emerald-950/40 dark:to-emerald-900/30 sm:px-5">
                        <p className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                          Payment released
                        </p>
                        <p className="text-xl font-semibold leading-snug text-emerald-900 sm:text-2xl dark:text-emerald-100">
                          {`Payment of ${formatCents(
                            agreedAmountCents
                          )} has been released to you :)`}
                        </p>
                        <p className="text-sm leading-relaxed text-emerald-800 dark:text-emerald-200">
                          You received the full bid amount. The lister paid the platform fee separately.
                        </p>
                        <p className="text-sm leading-relaxed text-emerald-800/90 dark:text-emerald-200/90">
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
                !cleanerReviewPendingMinimal &&
                !listerReleaseFundsStep && (
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
                )
              )}
              {/* Platform fee breakdown handled above; avoid duplicating copy here. */}
            </>
          ) : hideCleanerCancelledAuctionUi ? (
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              This listing is no longer accepting bids.
            </p>
          ) : isListingOwner && !isCleaner ? (
            <div className="space-y-5 rounded-2xl border border-border bg-gradient-to-b from-muted/40 to-muted/10 p-4 dark:border-gray-700 dark:from-gray-900/50 dark:to-gray-950/30 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-6 sm:gap-y-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground dark:text-gray-400 sm:text-sm">
                    Starting price
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-foreground dark:text-gray-100 sm:text-2xl">
                    {formatCents(listing.starting_price_cents)}
                  </p>
                </div>
                {listing.buy_now_cents != null && listing.buy_now_cents > 0 && (
                  <div className="min-w-0 sm:text-right">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground dark:text-gray-400 sm:text-sm">
                      Buy now
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-foreground dark:text-gray-100 sm:text-2xl">
                      {formatCents(listing.buy_now_cents)}
                    </p>
                    {listing.current_lowest_bid_cents < listing.buy_now_cents && (
                      <p className="mt-3 max-w-md rounded-xl bg-amber-50 px-3 py-2 text-left text-sm leading-snug text-amber-900 dark:bg-amber-900/30 dark:text-amber-100 sm:ml-auto sm:text-right">
                        Current bid is below the fixed price. Securing at this price may no longer be available.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border-2 border-primary/30 bg-background/95 px-4 py-5 dark:border-primary/40 dark:bg-gray-950/80 sm:px-6 sm:py-6">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground dark:text-gray-400 sm:text-sm">
                  Current lowest bid
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums leading-none tracking-tight text-primary sm:text-4xl md:text-5xl">
                  {formatCents(listing.current_lowest_bid_cents)}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 dark:border-gray-600 dark:bg-gray-800/70">
                <span className="text-base font-medium text-muted-foreground dark:text-gray-300">
                  Platform fee ({feePercentage}%)
                </span>
                <span className="text-2xl font-semibold tabular-nums text-foreground dark:text-gray-100 sm:text-3xl">
                  {formatCents(platformFeeOnCurrentBidCents)}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground dark:text-gray-500">
                Fee is calculated on the current lowest bid and updates as bids change.
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-4 sm:grid-cols-2",
                detailUiBoost &&
                  "rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.1] to-transparent p-4 dark:border-emerald-900/50 dark:from-emerald-950/40 sm:p-5"
              )}
            >
              <div>
                <p
                  className={cn(
                    "font-medium text-muted-foreground dark:text-gray-400",
                    detailUiBoost ? "text-sm" : "text-xs"
                  )}
                >
                  Starting price
                </p>
                <p
                  className={cn(
                    "font-semibold tabular-nums dark:text-gray-100",
                    detailUiBoost ? "text-xl" : "text-base"
                  )}
                >
                  {formatCents(listing.starting_price_cents)}
                </p>
              </div>
              <div>
                <p
                  className={cn(
                    "font-medium text-muted-foreground dark:text-gray-400",
                    detailUiBoost ? "text-sm" : "text-xs"
                  )}
                >
                  Current lowest bid
                </p>
                <p
                  className={cn(
                    "font-bold tabular-nums text-primary dark:text-primary",
                    detailUiBoost ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
                  )}
                >
                  {formatCents(listing.current_lowest_bid_cents)}
                </p>
              </div>
              {listing.buy_now_cents != null && listing.buy_now_cents > 0 && (
                <div className="sm:col-span-2">
                  <p
                    className={cn(
                      "font-medium text-muted-foreground dark:text-gray-400",
                      detailUiBoost ? "text-sm" : "text-xs"
                    )}
                  >
                    Buy now
                  </p>
                  <p
                    className={cn(
                      "font-semibold tabular-nums dark:text-gray-100",
                      detailUiBoost ? "text-xl" : "text-base"
                    )}
                  >
                    {formatCents(listing.buy_now_cents)}
                  </p>
                  {listing.current_lowest_bid_cents < listing.buy_now_cents && (
                    <p
                      className={cn(
                        "mt-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
                        detailUiBoost ? "text-sm leading-snug" : "mt-1.5 px-2 py-1 text-xs"
                      )}
                    >
                      Current bid is below the fixed price. Securing at this price may no longer be available.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {bondGuideline &&
            !cleanerReviewPendingMinimal &&
            !listerReleaseFundsStep && (
            <details
              className={cn(
                "mt-2 text-muted-foreground dark:text-gray-400",
                detailUiBoost ? "text-sm" : "text-xs"
              )}
            >
              <summary
                className={cn(
                  "cursor-pointer select-none rounded-lg py-2 font-medium dark:text-gray-300",
                  detailUiBoost && "min-h-12 text-base"
                )}
              >
                Bond cleaning guideline ({bondGuideline.state})
              </summary>
              <div className="mt-2 space-y-2 rounded-xl border border-border bg-muted/30 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-200">
                <p className={cn(detailUiBoost ? "text-sm leading-relaxed" : "text-[11px]")}>
                  {bondGuideline.summary}
                </p>
                <ul
                  className={cn(
                    "list-inside list-disc space-y-1",
                    detailUiBoost ? "text-sm" : "text-[11px]"
                  )}
                >
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

          <Dialog
            open={showCancelListingDialog}
            onOpenChange={(open) => {
              if (!cancellingListing) setShowCancelListingDialog(open);
            }}
          >
            <DialogContent className="max-w-md dark:border-gray-700 dark:bg-gray-900">
              <DialogHeader>
                <DialogTitle>Cancel this listing?</DialogTitle>
                <DialogDescription className="text-left">
                  This will end the auction early. No new bids will be accepted, and cleaners who bid will see that the
                  listing has ended. The listing stays in your history. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCancelListingDialog(false)}
                  disabled={cancellingListing}
                >
                  Keep listing live
                </Button>
                <Button
                  variant="destructive"
                  disabled={cancellingListing}
                  onClick={async () => {
                    if (isOffline) {
                      toast({
                        title: "Offline",
                        description: "Reconnect to cancel this listing.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setCancellingListing(true);
                    try {
                      const { cancelListing } = await import("@/lib/actions/listings");
                      const res = await cancelListing(String(listingId));
                      if (res.ok) {
                        setListing((prev) => ({ ...prev, status: "ended" } as ListingRow));
                        setShowCancelListingDialog(false);
                        toast({
                          title: "Listing cancelled",
                          description: "The auction has ended early. You can view it under My Listings.",
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
                  }}
                >
                  {cancellingListing ? "Cancelling…" : "Yes, end listing early"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Shown only when Stripe test mode is enabled in Admin > Global Settings */}
          {isStripeTestMode &&
            isJobLister &&
            hasActiveJob &&
            !listerReleaseFundsStep &&
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
                <div
                  className={cn(
                    "space-y-3 rounded-xl border bg-background/60 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50",
                    checklistParty &&
                      "border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-transparent px-4 py-4 dark:from-emerald-950/25 sm:px-5"
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p
                        className={cn(
                          "font-semibold dark:text-gray-100",
                          checklistParty ? "text-lg" : "text-sm font-medium"
                        )}
                      >
                        Cleaning checklist
                      </p>
                      <p
                        className={cn(
                          "text-muted-foreground dark:text-gray-400",
                          checklistParty ? "text-sm leading-relaxed" : "text-xs"
                        )}
                      >
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
                    <div className="space-y-3">
                      {checklist.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-start justify-between gap-2 dark:text-gray-200",
                            checklistParty ? "text-base" : "text-xs"
                          )}
                        >
                          <label className="flex min-h-[44px] flex-1 items-start gap-3">
                            <Checkbox
                              checked={item.is_completed}
                              onCheckedChange={(value) =>
                                handleToggleItem(item, value === true)
                              }
                              className={cn(
                                "mt-0.5",
                                checklistParty ? "h-5 w-5" : "h-3.5 w-3.5"
                              )}
                            />
                            <span className="leading-snug">{item.label}</span>
                          </label>
                          {isJobLister && (
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              className={cn(
                                "text-muted-foreground hover:text-destructive dark:text-gray-400 dark:hover:text-red-400",
                                listerDetailUI
                                  ? "min-h-11 px-2 text-xs font-medium"
                                  : "px-1 text-[10px]"
                              )}
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
                        variant="outline"
                        className={cn(
                          isJobCleaner
                            ? "min-h-12 rounded-xl px-4 text-sm font-semibold"
                            : "text-[10px]"
                        )}
                        size={isJobCleaner ? "default" : "xs"}
                        onClick={handleMarkAllComplete}
                      >
                        Mark all tasks as complete
                      </Button>
                    </div>
                  )}

                  {allCompleted && (
                    <p
                      className={cn(
                        "mt-1 rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                        checklistParty ? "text-sm leading-relaxed" : "text-[11px]"
                      )}
                    >
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
                  {!(isJobCleaner && cleanerReviewPendingMinimal) && (
                    <>
                  {!(isJobLister && listerReleaseFundsStep) && (
                  <details
                    className={cn(
                      "rounded-xl border bg-background/60 px-4 py-3 text-muted-foreground dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
                      detailUiBoost ? "text-sm" : "text-xs"
                    )}
                  >
                    <summary
                      className={cn(
                        "cursor-pointer select-none font-medium text-foreground dark:text-gray-100",
                        detailUiBoost ? "min-h-12 text-base" : "text-sm"
                      )}
                    >
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
                            className={cn(
                              "flex items-start gap-2 dark:text-gray-200",
                              detailUiBoost ? "text-sm" : "text-xs"
                            )}
                          >
                            <Checkbox
                              checked={item.is_completed}
                              className={cn(
                                "mt-0.5",
                                detailUiBoost ? "h-4 w-4" : "h-3.5 w-3.5"
                              )}
                              disabled
                            />
                            <span>{item.label}</span>
                          </div>
                        ))}
                    </div>
                  </details>
                  )}
                  {localJobStatus === "completed" ? (
                  <p
                    className={cn(
                      "mt-1 rounded-md bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
                      detailUiBoost ? "text-sm leading-relaxed" : "text-[11px]"
                    )}
                  >
                    Payment has been released. Thanks for completing this bond clean through Bond Back.
                  </p>
                  ) : (
                    !(isJobLister && listerReleaseFundsStep) && (
                  <p
                    className={cn(
                      "mt-1 rounded-md bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
                      detailUiBoost ? "text-sm leading-relaxed" : "text-[11px]"
                    )}
                  >
                    Waiting on final approval and payment release…
                  </p>
                    )
                  )}
                    </>
                  )}
                  {isJobLister && afterPhotoEntries.length > 0 && (
                    <div className="mt-3 rounded-2xl border border-emerald-400/50 bg-gradient-to-br from-emerald-50/90 to-transparent px-4 py-4 dark:border-emerald-800 dark:from-emerald-950/40 sm:px-5">
                      <p className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                        After photos from your cleaner
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-emerald-800 dark:text-emerald-200">
                        Review the after photos before you finalize and release funds.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {afterPhotoEntries.map((entry) => (
                          <div
                            key={entry.name}
                            className="relative h-20 w-24 overflow-hidden rounded-md border bg-muted/40 cursor-pointer dark:border-gray-700 dark:bg-gray-800/60 group"
                            onClick={() => setLightboxUrl(entry.url)}
                          >
                            <Image
                              src={entry.url}
                              alt="After clean"
                              fill
                              sizes="96px"
                              quality={65}
                              loading="lazy"
                              placeholder="blur"
                              blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
                              className="object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {isJobCleaner && (
                <div className="mt-4 space-y-3 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-transparent px-4 py-4 dark:border-violet-900/40 dark:from-violet-950/30 sm:px-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold dark:text-gray-100">After photos</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
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
                      {afterPhotoEntries.map((entry) => (
                          <div
                            key={entry.name}
                            className="relative h-20 w-24 overflow-hidden rounded-md border border-border bg-muted/40 dark:border-gray-700 dark:bg-gray-800/60 cursor-pointer group"
                            onClick={() => setLightboxUrl(entry.url)}
                          >
                            <Image
                              src={entry.url}
                              alt="After clean"
                              fill
                              sizes="96px"
                              quality={65}
                              loading="lazy"
                              placeholder="blur"
                              blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
                              className="object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                            <button
                              type="button"
                              aria-label="Remove photo"
                              className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                              onClick={(e) => {
                                e.stopPropagation();
                                const folder = `jobs/${numericJobId}/after`;
                                const mainPath = `${folder}/${entry.name}`;
                                const thumbPath = `${folder}/thumb_${entry.name}`;
                                void supabase.storage
                                  .from("condition-photos")
                                  .remove([mainPath])
                                  .then(({ error }) => {
                                    if (error) {
                                      toast({
                                        variant: "destructive",
                                        title: "Remove failed",
                                        description: error.message,
                                      });
                                      return;
                                    }
                                    void supabase.storage.from("condition-photos").remove([thumbPath]);
                                    setAfterPhotoEntries((prev) => prev.filter((p) => p.name !== entry.name));
                                  });
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "gap-1",
                        "min-h-12 rounded-xl px-4 text-sm font-semibold"
                      )}
                      disabled={afterPhotosUploading || afterPhotoEntries.length >= PHOTO_LIMITS.JOB_AFTER}
                      asChild
                    >
                      <label className={afterPhotoEntries.length >= PHOTO_LIMITS.JOB_AFTER ? "cursor-not-allowed pointer-events-none" : "cursor-pointer"}>
                        <ImagePlus className="mr-2 h-5 w-5" />
                        <span>
                          {afterPhotosUploading
                            ? "Uploading…"
                            : "Upload / add photos"}
                        </span>
                        <input
                          key={`after-upload-${afterPhotoEntries.map((e) => e.name).sort().join("|")}`}
                          type="file"
                          accept={PHOTO_VALIDATION.ACCEPT}
                          multiple={afterPhotoEntries.length === 0}
                          className="hidden"
                          onChange={async (event: ChangeEvent<HTMLInputElement>) => {
                            if (!numericJobId) return;
                            const files = event.target.files;
                            if (!files || files.length === 0) return;
                            const picked = dedupeImageFiles(Array.from(files));
                            if (picked.length === 0) {
                              event.target.value = "";
                              return;
                            }
                            const existingCount = afterPhotoEntries.length;
                            const { validFiles, errors } = validatePhotoFiles(picked, {
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
                    <span className="text-sm font-medium text-muted-foreground dark:text-gray-400">
                      {afterPhotoEntries.length}/{PHOTO_LIMITS.JOB_AFTER} photos
                    </span>
                  </div>
                  {localJobStatus === "in_progress" && (
                    <div className="space-y-2 border-t border-violet-500/10 pt-4 dark:border-violet-900/30">
                      <Button
                        type="button"
                        size="lg"
                        className="min-h-14 w-full rounded-xl bg-emerald-600 text-base font-semibold hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-600"
                        disabled={!allCompleted || !hasAfterPhotos || requestingPayment}
                        onClick={handleCleanCompleteRequestPayment}
                      >
                        {requestingPayment ? "Submitting…" : "Clean Complete — Request Payment"}
                      </Button>
                      {(!allCompleted || !hasAfterPhotos) && (
                        <p className="text-center text-[11px] text-muted-foreground dark:text-gray-500">
                          Tick every checklist item and upload at least 3 after-photos to continue.
                        </p>
                      )}
                    </div>
                  )}
                  {localJobStatus === "completed_pending_approval" && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                      You&apos;ve requested payment. Waiting for the property lister to review and release funds.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          {hasActiveJob &&
            isJobLister &&
            (localJobStatus === "in_progress" ||
              localJobStatus === "completed_pending_approval") && (
              <div className="space-y-2 rounded-md border bg-background/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium dark:text-gray-100">Approve &amp; Release Funds</p>
                  {localJobStatus === "completed_pending_approval" &&
                    (autoReleaseAt && autoReleaseMsLeft != null ? (
                      <Badge
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
                          autoReleaseBadgeClass
                        )}
                      >
                        {autoReleaseMsLeft <= 0
                          ? "Auto-release now"
                          : `Auto-release in ${formatAutoReleaseCountdown(autoReleaseMsLeft)}`}
                      </Badge>
                    ) : (
                      <Badge className="shrink-0 rounded-full border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
                        Auto-release paused
                      </Badge>
                    ))}
                </div>
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
                  autoReleaseMsLeft != null &&
                  autoReleaseMsLeft > 0 && (
                    <Progress value={autoReleaseProgressValue} className="h-2" />
                  )}
                <p className="text-xs text-muted-foreground dark:text-gray-400">
                  {localJobStatus === "completed_pending_approval"
                    ? "The cleaner has requested payment. Review after-photos, then release funds from escrow or raise a dispute with evidence. Opening a dispute pauses the auto-release timer until the dispute is resolved."
                    : `Once the checklist and after-photos are done, you can release funds from escrow. After the cleaner taps “Clean Complete — Request Payment”, you&apos;ll have ${autoReleaseHours} hours to approve or open a dispute.`}
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
                        Waiting for after photos to release funds. You can still open a dispute; that pauses auto-release.
                      </p>
                    )}
                    {!hasAfterPhotos && localJobStatus === "in_progress" && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Waiting for after photos to be uploaded…
                      </p>
                    )}
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                        {hasAfterPhotos && allCompleted && (
                          <Button
                            type="button"
                            size="lg"
                            disabled={!allCompleted || !hasAfterPhotos || isFinalizing}
                            onClick={handleFinalizePayment}
                            className="min-h-[48px] flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                          >
                            {isFinalizing ? "Releasing…" : "Approve & Release Funds"}
                          </Button>
                        )}

                        {localJobStatus === "completed_pending_approval" && (
                          <Button
                            type="button"
                            size="lg"
                            variant="outline"
                            className="min-h-[48px] flex-1 border-orange-500 bg-orange-50 text-orange-950 hover:bg-orange-100 hover:text-orange-950 dark:border-orange-600 dark:bg-orange-950/40 dark:text-orange-50 dark:hover:bg-orange-900/50"
                            onClick={() => setShowOpenDisputeForm(true)}
                          >
                            Raise Dispute
                          </Button>
                        )}
                      </div>
                      {canExtendListerReview && numericJobId != null && (
                        <div className="flex flex-col gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="w-full sm:w-auto"
                            disabled={isExtendingReview}
                            onClick={() => {
                              startExtendReview(async () => {
                                const res = await extendListerReview24h(numericJobId);
                                if (!res.ok) {
                                  toast({
                                    variant: "destructive",
                                    title: "Could not extend review",
                                    description: res.error,
                                  });
                                  return;
                                }
                                toast({
                                  title: "Review extended",
                                  description: "24 hours were added to the auto-release timer.",
                                });
                                router.refresh();
                              });
                            }}
                          >
                            {isExtendingReview ? "Extending…" : "Extend review by 24h"}
                          </Button>
                          <p className="text-[11px] text-muted-foreground dark:text-gray-500">
                            One-time extension per job. Use if you need more time before approving or disputing.
                          </p>
                        </div>
                      )}
                      {!!reviewExtensionUsedAt &&
                        localJobStatus === "completed_pending_approval" && (
                          <p className="text-[11px] text-muted-foreground dark:text-gray-500">
                            You already used the one-time 24-hour extension on this job.
                          </p>
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

          {!cleanerReviewPendingMinimal && !listerReleaseFundsStep && (
            <>
          {listing.special_instructions && (
            <div
              className={cn(
                detailUiBoost &&
                  "rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20"
              )}
            >
              <p
                className={cn(
                  "font-medium text-muted-foreground dark:text-gray-300",
                  detailUiBoost ? "text-sm font-semibold uppercase tracking-wide" : "text-xs"
                )}
              >
                Special instructions
              </p>
              <p
                className={cn(
                  "dark:text-gray-200",
                  detailUiBoost ? "mt-2 text-base leading-relaxed" : "text-sm"
                )}
              >
                {listing.special_instructions}
              </p>
            </div>
          )}
          {listing.addons && Array.isArray(listing.addons) && listing.addons.length > 0 && (
            <div>
              <p
                className={cn(
                  "font-medium text-muted-foreground dark:text-gray-300",
                  detailUiBoost ? "text-sm font-semibold" : "text-xs"
                )}
              >
                Add-ons included
              </p>
              <div
                className={cn(
                  "mt-2 flex flex-wrap gap-2",
                  detailUiBoost ? "text-sm" : "text-xs"
                )}
              >
                {listing.addons.map((addon) => (
                  <span
                    key={addon}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 dark:bg-gray-700/60 dark:text-gray-200"
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
                    <p
                      className={cn(
                        "font-medium text-muted-foreground dark:text-gray-300",
                        detailUiBoost ? "text-sm font-semibold" : "text-xs"
                      )}
                    >
                      Preferred cleaning dates
                    </p>
                    <ul
                      className={cn(
                        "mt-1 space-y-1 dark:text-gray-200",
                        detailUiBoost ? "text-base font-medium" : "text-sm"
                      )}
                    >
                      {dates.map((d) => (
                        <li key={d.toISOString()}>
                          {format(d, "EEEE, MMMM 'the' do yyyy")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  className={cn(
                    "rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50",
                    detailUiBoost && "px-4 py-3"
                  )}
                >
                  <p
                    className={cn(
                      "font-semibold text-sky-900 dark:text-gray-100",
                      detailUiBoost ? "text-base" : "text-xs"
                    )}
                  >
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
                            <Image
                              src={entry.url}
                              alt="Property"
                              fill
                              sizes="96px"
                              quality={65}
                              loading="lazy"
                              placeholder="blur"
                              blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
                              className="object-cover transition-transform duration-200 group-hover:scale-105"
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
            </>
          )}

          {!(isCleaner && hideCleanerCancelledAuctionUi) &&
            !cleanerReviewPendingMinimal &&
            !listerReleaseFundsStep && (
            <BidHistorySection
              bids={bids}
              onAcceptBid={
                isListingOwner && !hasActiveJob ? handleAcceptBid : undefined
              }
              largeTouch={detailUiBoost}
              defaultOpen={Boolean(showAuctionActions && isListingOwner && !isCleaner)}
              className={cn(
                "mt-4 border-t border-border pt-4 text-muted-foreground dark:border-gray-700 dark:text-gray-500",
                detailUiBoost ? "text-sm" : "text-[11px]"
              )}
            />
          )}
        </CardContent>
      </Card>

      {showAuctionActions && (
        <Card
          id="place-bid"
          className={cn(
            "scroll-mt-20 overflow-hidden border-border shadow-sm md:scroll-mt-8 dark:border-gray-800 dark:bg-gray-950/40",
            detailUiBoost &&
              "rounded-2xl border-border/90 ring-1 ring-emerald-500/15 dark:ring-emerald-900/30"
          )}
        >
          <CardHeader
            className={cn(
              "space-y-1 pb-2 pt-6 sm:pb-3 sm:pt-6",
              detailUiBoost && "px-4 sm:px-6"
            )}
          >
            <CardTitle
              className={cn(
                "font-semibold tracking-tight",
                detailUiBoost ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"
              )}
            >
              Place a lower bid
            </CardTitle>
            <CardDescription
              className={cn("leading-snug", detailUiBoost ? "text-base" : "text-sm")}
            >
              Reverse auction: cleaners compete by bidding{" "}
              <span className="font-medium text-foreground dark:text-gray-200">below</span> the current
              lowest price.
            </CardDescription>
          </CardHeader>
          <CardContent
            className={cn("space-y-5 pb-6 pt-0 sm:pb-6", detailUiBoost && "px-4 sm:px-6")}
          >
            <PlaceBidForm
              listingId={listingId}
              listing={listing}
              isCleaner={isCleaner}
              currentUserId={currentUserId}
            />

            {isCleaner &&
              listing.buy_now_cents != null &&
              listing.buy_now_cents > 0 &&
              listing.current_lowest_bid_cents >= listing.buy_now_cents && (
                <div className="rounded-2xl border border-violet-200/80 bg-violet-50/50 px-4 py-4 dark:border-violet-900/40 dark:bg-violet-950/25">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">
                    Or skip the auction
                  </p>
                  <p className="mt-1 text-xs text-violet-700/90 dark:text-violet-200/80">
                    Secure this job at the buy-now price instead of waiting for the auction to end.
                  </p>
                  <div className="mt-3">
                    <BuyNowButton
                      listingId={listingId}
                      buyNowCents={listing.buy_now_cents}
                      disabled={!isLive}
                      currentUserId={currentUserId}
                      className="w-full min-h-14 justify-center px-4 text-base font-semibold sm:flex-1"
                    />
                  </div>
                </div>
              )}
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
            <Image
              src={lightboxUrl}
              alt="Photo full size"
              width={1600}
              height={1200}
              sizes="100vw"
              quality={85}
              placeholder="blur"
              blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
              className="max-h-[90vh] max-w-[90vw] h-auto w-auto rounded-md object-contain shadow-lg"
              priority
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BidHistorySection({
  bids,
  onAcceptBid,
  className,
  largeTouch = false,
  /** Lister live auction: start expanded. After auction/job won, collapsed. */
  defaultOpen = false,
}: {
  bids: BidWithBidder[];
  onAcceptBid?: (bid: BidWithBidder) => Promise<void>;
  className?: string;
  /** Larger summary + body copy (cleaner or lister job detail). */
  largeTouch?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className={className}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none select-none items-center rounded-xl py-2 font-medium text-foreground hover:bg-muted/50 dark:text-gray-100 dark:hover:bg-gray-800/70 [&::-webkit-details-marker]:hidden",
          largeTouch ? "min-h-14 text-base sm:text-lg" : "min-h-11 text-sm"
        )}
      >
        View bid history
      </summary>
      {bids.length > 0 ? (
        <div className="mt-2">
          <BidHistoryTable bids={bids} onAcceptBid={onAcceptBid} />
        </div>
      ) : (
        <p
          className={cn(
            "mt-2 text-muted-foreground dark:text-gray-400",
            largeTouch ? "text-sm" : "text-[11px]"
          )}
        >
          No bids were placed on this listing.
        </p>
      )}
    </details>
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
