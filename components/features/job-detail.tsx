"use client";

import {
  useEffect,
  useState,
  useRef,
  useTransition,
  useCallback,
  useMemo,
  type ChangeEvent,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { scheduleRouterAction, scrollToTopAfterBidAccepted } from "@/lib/deferred-router";
import { format } from "date-fns";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { CountdownTimer } from "@/components/features/countdown-timer";
import { ListingEndsAtLocal } from "@/components/features/listing-ends-at-local";
import {
  BidHistoryTable,
  type BidWithBidder,
  type ClosedAuctionBidStatus,
} from "@/components/features/bid-history-table";
import { PlaceBidForm } from "@/components/features/place-bid-form";
import { BuyNowButton } from "@/components/features/buy-now-button";
import {
  formatCents,
  collectListingPhotoUrls,
  mergePhotoUrlLists,
  orderCoverPhotoFirst,
  isListingLive,
} from "@/lib/listings";
import {
  parseListingCalendarDate,
  formatDateDdMmYyyy,
  humanizePropertyCondition,
  listingPropertyDescriptionBody,
  preferredWindowFromMoveOutDate,
  specialInstructionsForDisplay,
} from "@/lib/listing-detail-presenters";
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
import { formatListingAddonDisplayName } from "@/lib/listing-addon-prices";
import { isListingAddonSpecialArea } from "@/lib/listing-special-areas";
import type { BidRow } from "@/lib/listings";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";
import {
  ImagePlus,
  CheckCircle2,
  Star,
  MapPin,
  X,
  ImageIcon,
  Bed,
  Bath,
  Calendar,
  Info,
  Sparkles,
  Images,
  Clock,
  Gavel,
  LockOpen,
  Unlock,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { ImageLightboxGallery } from "@/components/ui/image-lightbox-gallery";
import { ReviewForm } from "@/components/features/review-form";
import { GuidedDisputeForm } from "@/components/features/guided-dispute-form";
import { useToast } from "@/components/ui/use-toast";
import { showAppErrorToast } from "@/components/errors/show-app-error-toast";
import { logClientError } from "@/lib/errors/log-client-error";
import { useIsOffline } from "@/hooks/use-offline";
import {
  respondToDispute,
  acceptResolution,
  acceptRefund,
  counterRefund,
  rejectRefund,
  acceptCounterRefund,
  extendListerReview24h,
} from "@/lib/actions/jobs";
import { requestEarlyBidAcceptance } from "@/lib/actions/early-bid-acceptance";
import { resolveAuctionEndForListing } from "@/lib/actions/auction-resolution";
import { cancelLastBid } from "@/lib/actions/bids";
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
import { compressImage } from "@/lib/utils/compressImage";
import { NEXT_IMAGE_SIZES_THUMB_GRID } from "@/lib/next-image-sizes";
import { getStateFromPostcode, formatLocationWithState } from "@/lib/state-from-postcode";
import { getBondGuidelineForState } from "@/lib/bond-cleaning-guidelines";
import { canSendJobChatMessages } from "@/lib/chat-unlock";
import { ListerEndAuctionControl } from "@/components/listing/lister-end-auction-control";
import { JobPaymentTimeline, type JobPaymentTimelineProps } from "@/components/features/job-payment-timeline";
import { JobProgressTimeline } from "@/components/features/job-progress-timeline";
import { JobPaymentBreakdown } from "@/components/features/job-payment-breakdown";
import { VerificationBadges } from "@/components/shared/verification-badges";
import { hydrateBidderProfilesForListing } from "@/lib/actions/bidder-profile";

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

function JobHistoryCollapsible({
  enabled,
  title = "Job history — checklist &amp; after photos",
  children,
}: {
  enabled: boolean;
  /** When `enabled`, shown as the outer summary label. */
  title?: string;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <details className="rounded-2xl border border-border/80 bg-muted/15 dark:border-gray-700 dark:bg-gray-900/30">
      <summary className="cursor-pointer select-none list-none px-4 py-3 font-semibold text-foreground outline-none marker:content-none [&::-webkit-details-marker]:hidden dark:text-gray-100">
        {title}
      </summary>
      <div className="space-y-4 border-t border-border px-4 pb-4 pt-4 dark:border-gray-800">
        {children}
      </div>
    </details>
  );
}

type InitialPhotoEntry = { name: string; url: string };

function JobDetailInitialConditionPhotos({
  listing,
  listingId,
  detailUiBoost,
  initialPhotosLoading,
  initialPhotoEntries,
  setInitialPhotoEntries,
  setListing,
  setPhotoLightbox,
  supabase,
  isJobLister,
  isListingOwner,
  isCleaner,
  initialPhotosUploading,
  setInitialPhotosUploading,
}: {
  listing: ListingRow;
  listingId: string;
  detailUiBoost: boolean;
  initialPhotosLoading: boolean;
  initialPhotoEntries: InitialPhotoEntry[];
  setInitialPhotoEntries: Dispatch<SetStateAction<InitialPhotoEntry[]>>;
  setListing: Dispatch<SetStateAction<ListingRow>>;
  setPhotoLightbox: Dispatch<
    SetStateAction<{
      urls: string[];
      index: number;
      ariaLabel: string;
    } | null>
  >;
  supabase: ReturnType<typeof createBrowserSupabaseClient>;
  isJobLister: boolean;
  isListingOwner: boolean;
  isCleaner: boolean;
  initialPhotosUploading: boolean;
  setInitialPhotosUploading: Dispatch<SetStateAction<boolean>>;
}) {
  const { toast } = useToast();
  return (
    <div
      className={cn(
        detailUiBoost
          ? "rounded-2xl border border-border/90 bg-card px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-950/40 sm:px-6"
          : "rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50"
      )}
    >
      {detailUiBoost ? (
        <div className="mb-4 space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <p className="text-lg font-semibold text-foreground dark:text-gray-100">
              Initial condition photos
            </p>
          </div>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Photos supplied by the lister before the clean — tap to enlarge.
          </p>
        </div>
      ) : (
        <p
          className={cn(
            "font-semibold text-sky-900 dark:text-gray-100",
            detailUiBoost ? "text-base" : "text-xs"
          )}
        >
          Initial property photos (condition before bond clean)
        </p>
      )}
      {initialPhotosLoading ? (
        <p className="mt-2 text-xs text-muted-foreground dark:text-gray-400">Loading photos…</p>
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
            <div
              className={cn(
                "mt-2",
                detailUiBoost
                  ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3"
                  : "flex flex-wrap gap-2"
              )}
            >
              {displayEntries.map((entry, idx) => {
                const isDefault =
                  (listing as ListingRow & { cover_photo_url?: string | null }).cover_photo_url === entry.url;
                return (
                  <div
                    key={fromStorage ? entry.name : `fallback-${idx}`}
                    className={cn(
                      "relative cursor-pointer overflow-hidden border border-border bg-muted/40 group dark:border-gray-700 dark:bg-gray-800/60",
                      detailUiBoost ? "aspect-[4/3] w-full rounded-xl" : "h-20 w-24 rounded-md"
                    )}
                    onClick={() =>
                      setPhotoLightbox({
                        urls: displayEntries.map((e) => e.url),
                        index: idx,
                        ariaLabel: "Initial condition photos",
                      })
                    }
                  >
                    <Image
                      src={entry.url}
                      alt="Property"
                      fill
                      sizes={NEXT_IMAGE_SIZES_THUMB_GRID}
                      quality={75}
                      loading="lazy"
                      placeholder="blur"
                      blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
                      className="object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    {isDefault && (
                      <span className="absolute left-0.5 top-0.5 z-10 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-medium text-white">
                        Default
                      </span>
                    )}
                    {canEditInitialPhotos && !entry.name.startsWith("fallback-") && (
                      <button
                        type="button"
                        aria-label="Set as default photo"
                        className="absolute bottom-0.5 left-0.5 right-0.5 z-10 flex items-center justify-center gap-0.5 rounded bg-black/70 py-0.5 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          import("@/lib/actions/listings").then(({ updateListingCoverPhoto }) => {
                            updateListingCoverPhoto(listingId, entry.url).then((res) => {
                              if (res.ok) {
                                setListing((prev) => ({ ...prev, cover_photo_url: entry.url } as ListingRow));
                                toast({
                                  title: "Default photo set",
                                  description: "This photo will show on listing cards.",
                                });
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
                              toast({
                                variant: "destructive",
                                title: "Remove failed",
                                description: error.message,
                              });
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
              No photos uploaded yet. Minimum 3 photos required before starting the job.
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
            <label
              className={
                initialPhotoEntries.length >= PHOTO_LIMITS.LISTING_INITIAL
                  ? "pointer-events-none cursor-not-allowed"
                  : "cursor-pointer"
              }
            >
              <ImagePlus className="mr-1 h-3.5 w-3.5" />
              <span>{initialPhotosUploading ? "Uploading…" : "Upload / add photos"}</span>
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
                    try {
                      const compressed = await compressImage(f);
                      const header = await checkImageHeader(compressed);
                      if (!header.valid) {
                        toast({
                          variant: "destructive",
                          title: "Photo validation",
                          description: `${f.name}: ${header.error}`,
                        });
                        continue;
                      }
                      withHeaderCheck.push(compressed);
                    } catch {
                      toast({
                        variant: "destructive",
                        title: "Couldn’t prepare photo",
                        description: `${f.name}: try another image.`,
                      });
                    }
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
                            const {
                              data: { publicUrl },
                            } = supabase.storage
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
  );
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

  // Keep client state in sync when the server page refreshes (e.g. after placeBid → router.refresh()).
  // `useState(initial*)` only applies on mount; without this, lowest bid / bid history stay stale.
  useEffect(() => {
    setListing(initialListing);
  }, [initialListing]);

  useEffect(() => {
    setBids((prev) => {
      // After a failed placeBid, Next can refetch RSC with an empty `bids` payload while the
      // listing row still shows a price below starting (real bids exist). Don't wipe history.
      if (initialBids.length === 0 && prev.length > 0) {
        const auctionHasBids =
          initialListing.current_lowest_bid_cents < initialListing.starting_price_cents;
        if (auctionHasBids) {
          return prev;
        }
      }
      return initialBids;
    });
  }, [
    initialBids,
    initialListing.current_lowest_bid_cents,
    initialListing.starting_price_cents,
  ]);

  /** Prefer min(bids) when `listings.current_lowest_bid_cents` is stale (e.g. RLS blocked updates). */
  const effectiveCurrentLowestCents = useMemo(() => {
    const fromBids =
      bids.length > 0
        ? Math.min(...bids.map((b) => Number(b.amount_cents ?? 0)))
        : null;
    const fromListing = listing.current_lowest_bid_cents;
    if (fromBids == null) return fromListing;
    return Math.min(fromListing, fromBids);
  }, [bids, listing.current_lowest_bid_cents]);

  const listingForBid = useMemo(
    () => ({
      ...listing,
      current_lowest_bid_cents: effectiveCurrentLowestCents,
    }),
    [listing, effectiveCurrentLowestCents]
  );

  const [localJobStatus, setLocalJobStatus] = useState<string | null>(
    jobStatus ?? (hasActiveJob ? "accepted" : null)
  );
  /**
   * `useState` only uses the initial value on mount. After "Accept bid", `router.refresh()`
   * delivers `hasActiveJob` + `jobStatus` from the server but `localJobStatus` stayed null,
   * so Pay & Start Job never appeared until a full reload. Sync when a job first appears.
   */
  const prevHasActiveJobRef = useRef(hasActiveJob);
  useEffect(() => {
    if (prevHasActiveJobRef.current === false && hasActiveJob === true) {
      setLocalJobStatus(jobStatus ?? "accepted");
    }
    prevHasActiveJobRef.current = hasActiveJob;
  }, [hasActiveJob, jobStatus]);
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
  const [photoLightbox, setPhotoLightbox] = useState<{
    urls: string[];
    index: number;
    ariaLabel: string;
  } | null>(null);
  const [showListerFinalizeNotice, setShowListerFinalizeNotice] =
    useState(false);
  const [submittedCleanerReview, setSubmittedCleanerReview] = useState(false);
  const [submittedListerReview, setSubmittedListerReview] = useState(false);
  const [showCleanerReviewForm, setShowCleanerReviewForm] = useState(false);
  const [showListerReviewForm, setShowListerReviewForm] = useState(false);
  const [showOpenDisputeForm, setShowOpenDisputeForm] = useState(false);
  const [showApproveReleaseConfirm, setShowApproveReleaseConfirm] = useState(false);
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
  const handleAuctionTimerExpired = useCallback(() => {
    void resolveAuctionEndForListing(listingId).then(() => {
      router.refresh();
    });
  }, [listingId, router]);

  const handleAcceptBid = useCallback(
    async (bid: BidWithBidder) => {
      const result = await requestEarlyBidAcceptance(listingId, bid.id);
      if (result.ok) {
        toast({
          title: "Bid accepted — job created",
          description:
            "The cleaner has been notified by email and in-app. They can open the job when the lister pays & starts.",
        });
        scheduleRouterAction(() => router.refresh());
        scrollToTopAfterBidAccepted();
      } else {
        logClientError("earlyBidAccept", result.error, {
          listingId,
          bidId: bid.id,
        });
        showAppErrorToast(toast, {
          flow: "earlyAccept",
          error: new Error(result.error ?? ""),
          context: "jobDetail.earlyAccept",
        });
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
          const row = payload.new as BidRow;
          void hydrateBidderProfilesForListing(listingId, [row.cleaner_id]).then((res) => {
            const profile =
              res.ok && res.byId[row.cleaner_id] ? res.byId[row.cleaner_id] : null;
            setBids((prev) => [{ ...row, bidder_profile: profile }, ...prev]);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, listingId]);

  const missingBidderProfileKey = useMemo(
    () =>
      bids
        .filter((b) => !b.bidder_profile)
        .map((b) => b.cleaner_id)
        .sort()
        .join(","),
    [bids]
  );

  useEffect(() => {
    if (!missingBidderProfileKey) return;
    const cleanerIds = missingBidderProfileKey.split(",").filter(Boolean);
    if (cleanerIds.length === 0) return;
    let cancelled = false;
    void hydrateBidderProfilesForListing(listingId, cleanerIds).then((res) => {
      if (cancelled || !res.ok || Object.keys(res.byId).length === 0) return;
      setBids((prev) =>
        prev.map((b) => {
          const p = res.byId[b.cleaner_id];
          return p && !b.bidder_profile ? { ...b, bidder_profile: p } : b;
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [listingId, missingBidderProfileKey]);

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

  const isLive = isListingLive(listing);

  /**
   * Countdown hit zero but listing is still `live` and no job row yet — server is assigning the winner.
   * Avoid flashing “Listing ended” / struck-through bids before refresh.
   */
  const pendingAutoAssignWinner = useMemo(() => {
    if (hasActiveJob) return false;
    if (isLive) return false;
    if (String(listing.status ?? "").toLowerCase() !== "live") return false;
    return bids.some((b) => b.status === "active");
  }, [hasActiveJob, isLive, listing.status, bids]);

  /** Ended auction with no job: match listing detail “closed” visuals on boosted layout. */
  const showEndedListingVisual = !isLive && !hasActiveJob && !pendingAutoAssignWinner;
  const endedListingBannerLabel = listing.cancelled_early_at
    ? "Listing cancelled"
    : "Listing ended";
  const closedAuctionBidStatus: ClosedAuctionBidStatus | null =
    !isLive && !pendingAutoAssignWinner
      ? listing.cancelled_early_at
        ? "lister_cancelled"
        : "auction_ended"
      : null;
  const isListingCancelled = String(listing.status).toLowerCase() === "cancelled";
  const isJobCancelled =
    localJobStatus === "cancelled" || jobStatus === "cancelled";
  /** Hide auction/timer/bid UI for cleaners on cancelled listing or cancelled job only */
  const hideCleanerCancelledAuctionUi =
    isCleaner && (isListingCancelled || isJobCancelled);
  const showAuctionActions =
    isLive && !hasActiveJob && !hideCleanerCancelledAuctionUi;
  const isSold = !!hasActiveJob;

  const showRevertLastBidInHistory =
    isCleaner &&
    isLive &&
    !hasActiveJob &&
    Boolean(
      currentUserId &&
        bids.some(
          (b) =>
            b.cleaner_id === currentUserId && b.status === "active"
        )
    );

  const handleRevertLastBid = useCallback(async () => {
    try {
      const result = await cancelLastBid(listingId);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Could not revert bid",
          description: result.error,
        });
        return;
      }
      toast({
        title: "Bid removed",
        description: "Your last bid on this listing was withdrawn.",
      });
      router.refresh();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not revert bid",
        description: e instanceof Error ? e.message : "Something went wrong.",
      });
    }
  }, [listingId, toast, router]);

  /** Platform fee on current lowest bid amount (lister view; updates with listing realtime). */
  const platformFeeOnCurrentBidCents = useMemo(() => {
    const jobCents = Number(effectiveCurrentLowestCents ?? 0);
    if (!Number.isFinite(jobCents) || jobCents <= 0 || !Number.isFinite(feePercentage)) return 0;
    return Math.round((jobCents * feePercentage) / 100);
  }, [effectiveCurrentLowestCents, feePercentage]);

  const searchParams = useSearchParams();
  const pathname = usePathname();

  /** Lister menu / card: ?cancel=1 opens “cancel listing early” (auction still live, no job yet). */
  useEffect(() => {
    if (searchParams.get("cancel") !== "1") return;
    if (isListingOwner && !hasActiveJob && isListingLive(listing)) {
      setShowCancelListingDialog(true);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cancel");
    const qs = params.toString();
    scheduleRouterAction(() =>
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    );
  }, [
    searchParams,
    pathname,
    router,
    isListingOwner,
    hasActiveJob,
    listing,
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
    scheduleRouterAction(() =>
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    );
    return () => window.clearTimeout(t);
  }, [searchParams, pathname, router]);

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
        scheduleRouterAction(() => router.refresh());
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
      return;
    }
    const nextList = (checklist ?? []).map((it) =>
      it.id === item.id ? { ...it, is_completed: next } : it
    );
    const allDone =
      nextList.length > 0 && nextList.every((x) => x.is_completed);
    if (allDone && currentUserId) {
      void import("@/lib/actions/notifications").then(({ notifyChecklistAllComplete }) =>
        notifyChecklistAllComplete(numericJobId, currentUserId)
      );
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
      return;
    }
    if (currentUserId) {
      void import("@/lib/actions/notifications").then(({ notifyChecklistAllComplete }) =>
        notifyChecklistAllComplete(numericJobId, currentUserId)
      );
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

  const listingHeroUrls = useMemo(() => {
    const fromDb = collectListingPhotoUrls(listing);
    const fromStorage = initialPhotoEntries.map((e) => e.url);
    const merged = mergePhotoUrlLists(fromStorage.length ? fromStorage : [], fromDb);
    return orderCoverPhotoFirst(merged, listing.cover_photo_url);
  }, [listing, initialPhotoEntries]);

  const heroSrc = listingHeroUrls[0] ?? null;
  const addressLine = formatLocationWithState(listing.suburb ?? "", listing.postcode ?? "");
  const beds = listing.bedrooms as number | undefined;
  const baths = listing.bathrooms as number | undefined;
  const propertyType = listing.property_type ? String(listing.property_type) : null;
  const conditionLabel = humanizePropertyCondition(
    (listing as { property_condition?: string | null }).property_condition
  );
  const levelsRaw = (listing as { property_levels?: string | null }).property_levels;
  const levelsLabel =
    levelsRaw != null && String(levelsRaw).trim() !== ""
      ? String(levelsRaw).includes("storey") || String(levelsRaw).includes("level")
        ? String(levelsRaw)
        : `${levelsRaw} storey${String(levelsRaw) === "1" ? "" : "s"}`
      : null;
  const addonsList = Array.isArray(listing.addons) ? listing.addons.filter(Boolean) : [];
  const specialInstructionsBody = useMemo(
    () => specialInstructionsForDisplay(listing.special_instructions),
    [listing.special_instructions]
  );
  const moveOutRaw = listing.move_out_date?.trim() ? listing.move_out_date : null;
  const moveOutDate = moveOutRaw ? parseListingCalendarDate(moveOutRaw) : null;
  const moveOutDisplay = moveOutDate ? formatDateDdMmYyyy(moveOutDate) : moveOutRaw;
  const preferredWindowFromMoveOut = preferredWindowFromMoveOutDate(moveOutDate);
  const preferredRaw = (listing as { preferred_dates?: string[] | null }).preferred_dates;
  const preferredDates =
    Array.isArray(preferredRaw) && preferredRaw.length > 0
      ? preferredRaw.filter((d) => d && String(d).trim())
      : [];
  const preferredDatesFormatted = preferredDates.map((d) => {
    const dt = parseListingCalendarDate(d);
    return dt ? formatDateDdMmYyyy(dt) : d;
  });
  const showPreferredFromMoveOut = moveOutDate != null && preferredWindowFromMoveOut != null;
  const showPreferredFallbackList =
    !showPreferredFromMoveOut && preferredDatesFormatted.length > 0;
  const startingCents = listing.starting_price_cents ?? 0;
  const buyNowCentsJob =
    typeof listing.buy_now_cents === "number" ? listing.buy_now_cents : null;
  const hasBuyNowJob = buyNowCentsJob != null && buyNowCentsJob > 0;

  const jobHeroStatusLabel = useMemo(() => {
    const s = localJobStatus ?? jobStatus ?? "";
    const map: Record<string, string> = {
      accepted: "Awaiting payment",
      in_progress: "In progress",
      completed_pending_approval: "Pending review",
      completed: "Completed",
      disputed: "Disputed",
      in_review: "Under review",
      dispute_negotiating: "Dispute",
      cancelled: "Cancelled",
    };
    return map[s] ?? (s ? s.replace(/_/g, " ") : "Job");
  }, [localJobStatus, jobStatus]);

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
      setShowApproveReleaseConfirm(false);
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
        scheduleRouterAction(() => router.refresh());
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

  /** Lister boosted job page after payment released — compact summary + Job history collapsible. */
  const listerCompletedBoostTidy =
    detailUiBoost && isJobLister && hasActiveJob && localJobStatus === "completed";

  /** Single “Won for” callout with fee copy — not duplicated with the pricing strip’s agreed column. */
  const showCleanerWonForCallout =
    hasActiveJob &&
    isJobCleaner &&
    localJobStatus !== "completed" &&
    !cleanerReviewPendingMinimal &&
    !listerReleaseFundsStep;

  /** Full address card for cleaners once the job is underway (maps / travel). Placed under payment timeline. */
  const showCleanerPropertyAddressCard =
    hasActiveJob &&
    isJobCleaner &&
    (localJobStatus === "in_progress" ||
      localJobStatus === "completed_pending_approval") &&
    !cleanerReviewPendingMinimal;

  const paymentReleasedAtForChat = paymentTimeline?.paymentReleasedAt ?? null;
  const showMessengerUnlockedBanner =
    !!jobId &&
    hasActiveJob &&
    (isJobLister || isJobCleaner) &&
    canSendJobChatMessages({
      status: localJobStatus ?? jobStatus,
      payment_released_at: paymentReleasedAtForChat,
    });

  return (
    <div
      className={cn(
        "space-y-6",
        detailUiBoost && "mx-auto w-full max-w-4xl pb-24 md:pb-10"
      )}
    >
      {paymentTimeline && (
        <JobPaymentTimeline {...paymentTimeline} />
      )}

      {showCleanerPropertyAddressCard && (
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
            This is the location for this bond clean job. Use it for your maps and travel planning.
          </p>
        </div>
      )}

      {detailUiBoost && (
        <>
          {isListingOwner && !hasActiveJob && isLive && (
            <div className="flex justify-end sm:justify-start">
              <ListerEndAuctionControl
                onRequestCancel={() => setShowCancelListingDialog(true)}
              />
            </div>
          )}

          <div
            className={cn(
              "overflow-hidden rounded-2xl border bg-card shadow-sm dark:bg-gray-950",
              showEndedListingVisual
                ? "border-red-900/50 ring-1 ring-red-500/25 dark:border-red-900/60"
                : "border-border dark:border-gray-800"
            )}
          >
            <div className="relative aspect-[16/10] max-h-[min(52vh,420px)] w-full bg-muted dark:bg-gray-900 md:aspect-[21/9] md:max-h-[380px]">
              {showEndedListingVisual && (
                <div
                  className="absolute inset-x-0 top-0 z-20 border-b border-red-900/50 bg-red-600 px-3 py-2.5 text-center shadow-[0_4px_24px_rgba(0,0,0,0.35)] sm:py-3"
                  role="status"
                >
                  <p className="text-sm font-black uppercase tracking-[0.14em] text-white sm:text-base md:text-lg">
                    {endedListingBannerLabel}
                  </p>
                </div>
              )}
              {heroSrc ? (
                <Image
                  src={heroSrc}
                  alt=""
                  fill
                  priority
                  className={cn(
                    "object-cover",
                    showEndedListingVisual && "opacity-[0.72] saturate-[0.65]"
                  )}
                  sizes="(max-width: 896px) 100vw, 896px"
                  placeholder="blur"
                  blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
                />
              ) : (
                <div className="flex h-full min-h-[200px] w-full items-center justify-center text-muted-foreground">
                  <Images className="h-16 w-16 opacity-40" aria-hidden />
                </div>
              )}
              {showEndedListingVisual && (
                <div className="absolute inset-0 bg-red-950/25 mix-blend-multiply dark:bg-red-950/35" aria-hidden />
              )}
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/48 to-transparent sm:via-black/38 md:from-black/75 md:via-black/25 md:to-transparent"
                aria-hidden
              />
              <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/60 to-transparent max-md:h-[36%] md:hidden" aria-hidden />
              <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-4 md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-2 sm:gap-3 max-md:rounded-xl max-md:border max-md:border-white/12 max-md:bg-black/40 max-md:p-2.5 max-md:shadow-[0_8px_28px_rgba(0,0,0,0.45)] max-md:backdrop-blur-md md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-balance text-[1.0625rem] font-bold leading-tight tracking-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_3px_16px_rgba(0,0,0,0.55)] sm:text-xl sm:leading-snug md:text-2xl md:leading-tight lg:text-3xl md:[text-shadow:0_2px_12px_rgba(0,0,0,0.55)]">
                      {listing.title ?? "Bond clean"}
                    </h1>
                    <p className="mt-0.5 flex items-start gap-1.5 text-xs font-medium text-white/95 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)] sm:mt-1 sm:items-center sm:gap-2 sm:text-sm md:[text-shadow:0_1px_8px_rgba(0,0,0,0.65)]">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0 sm:h-4 sm:w-4" aria-hidden />
                      <span className="min-w-0 leading-snug">
                        {listerReleaseFundsStep && propertyAddress?.trim()
                          ? `${propertyAddress.trim()} · ${addressLine}`
                          : isJobCleaner && propertyAddress?.trim()
                            ? propertyAddress.trim()
                            : addressLine}
                      </span>
                    </p>
                  </div>
                  {isLive && !hideCleanerCancelledAuctionUi ? (
                    <Badge className="shrink-0 border-0 bg-emerald-500/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md [box-shadow:0_2px_10px_rgba(0,0,0,0.4)] sm:px-2.5 sm:py-1.5 sm:text-xs md:text-sm">
                      Live auction
                    </Badge>
                  ) : hasActiveJob ? (
                    <Badge className="shrink-0 border-0 bg-violet-600/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md sm:px-2.5 sm:py-1.5 sm:text-xs md:text-sm">
                      Job · {jobHeroStatusLabel}
                    </Badge>
                  ) : pendingAutoAssignWinner ? (
                    <Badge className="shrink-0 border-0 bg-sky-600/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md sm:px-2.5 sm:py-1.5 sm:text-xs md:text-sm">
                      Finalising
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "shrink-0 font-bold uppercase tracking-wide",
                        showEndedListingVisual &&
                          "border-0 bg-red-950/90 text-white dark:bg-red-950/95"
                      )}
                    >
                      Not live
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {pendingAutoAssignWinner && (
              <div
                className="flex gap-3 border-t border-sky-500/30 bg-sky-500/[0.06] px-4 py-3 text-sm dark:border-sky-800/45 dark:bg-sky-950/30 dark:text-sky-100 md:px-6"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-sky-600 dark:text-sky-400" aria-hidden />
                <div>
                  <p className="font-semibold text-sky-950 dark:text-sky-50">Finalising auction</p>
                  <p className="mt-0.5 text-sky-950/85 dark:text-sky-100/90">
                    Assigning the winning bid and opening the job — this usually takes a moment.
                  </p>
                </div>
              </div>
            )}

            {isLive && !hideCleanerCancelledAuctionUi && (
              <div className="border-t border-border bg-gradient-to-r from-emerald-500/10 via-card to-sky-500/10 px-4 py-4 dark:border-gray-800 dark:from-emerald-950/40 dark:to-sky-950/30 md:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                      <Clock className="h-6 w-6" aria-hidden />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                        Time left
                      </p>
                      <CountdownTimer
                        endTime={listing.end_time}
                        expiredLabel="Auction ended"
                        className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300 md:text-2xl"
                        urgentBelowHours={24}
                        onExpired={handleAuctionTimerExpired}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground dark:text-gray-400">
                    <span className="font-medium text-foreground dark:text-gray-200">Ends: </span>
                    <ListingEndsAtLocal endTime={listing.end_time} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {isSold && listerCompletedBoostTidy ? (
            <div className="space-y-4">
              <div className="space-y-2 rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-4 py-4 dark:border-emerald-700 dark:from-emerald-950/40 dark:to-emerald-900/30 sm:px-5">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                  Payment released
                </p>
                <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300 sm:text-3xl">
                  {formatCents(agreedAmountCents)}
                </p>
                <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">
                  Paid to{" "}
                  <span className="font-semibold">
                    {cleanerName ? cleanerName.split(" ")[0] : "your cleaner"}
                  </span>
                  . Thank you for using Bond Back.
                </p>
              </div>
              <JobProgressTimeline
                detailUiBoost={detailUiBoost}
                localJobStatus={localJobStatus}
                hasActiveJob={!!hasActiveJob}
                hasPaymentHold={!!hasPaymentHold}
                allCompleted={!!allCompleted}
                hasAfterPhotos={!!hasAfterPhotos}
                isJobLister={!!isJobLister}
                isJobCleaner={!!isJobCleaner}
              />
            </div>
          ) : isSold ? (
            <>
              <Card className="overflow-hidden border-border/90 shadow-sm dark:border-gray-800">
                <CardContent className="p-0">
                  <div
                    className={cn(
                      "grid grid-cols-1 divide-y divide-border dark:divide-gray-800",
                      "md:divide-y-0 md:divide-x md:divide-border/80",
                      showCleanerWonForCallout
                        ? hasBuyNowJob
                          ? "md:grid-cols-2"
                          : "md:grid-cols-1"
                        : hasBuyNowJob
                          ? "md:grid-cols-3"
                          : "md:grid-cols-2"
                    )}
                  >
                    {!showCleanerWonForCallout && (
                      <div className="flex min-h-[5.25rem] flex-col justify-center gap-1 bg-emerald-500/[0.06] px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6 dark:bg-emerald-950/30">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                          {localJobStatus === "completed" ? "Job amount (paid)" : "Agreed job price"}
                        </p>
                        <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                          {formatCents(agreedAmountCents)}
                        </p>
                      </div>
                    )}
                    <div className="flex min-h-[5.25rem] flex-col justify-center gap-1 bg-card px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6 dark:bg-gray-950/40">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                        Starting bid
                      </p>
                      <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground dark:text-gray-100 sm:text-3xl">
                        {formatCents(startingCents)}
                      </p>
                    </div>
                    {hasBuyNowJob && (
                      <div className="flex min-h-[5.25rem] flex-col justify-center gap-1 bg-violet-500/[0.07] px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6 dark:bg-violet-950/35">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                          Buy now
                        </p>
                        <p className="text-2xl font-bold tabular-nums tracking-tight text-violet-700 dark:text-violet-300 sm:text-3xl">
                          {formatCents(buyNowCentsJob!)}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              {showCleanerWonForCallout && (
                <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50/70 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/40">
                  <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">Won for</p>
                  <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                    {formatCents(agreedAmountCents)}
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                    You will receive the full bid amount ({formatCents(agreedAmountCents)}). The lister pays
                    the platform fee separately.
                  </p>
                </div>
              )}
            </>
          ) : (
            <Card
              className={cn(
                "overflow-hidden shadow-sm dark:border-gray-800",
                showEndedListingVisual
                  ? "border-red-900/50 ring-1 ring-red-500/20 dark:border-red-900/60"
                  : "border-border/90"
              )}
            >
              <CardContent className="p-0">
                <div
                  className={cn(
                    "grid grid-cols-1 divide-y divide-border dark:divide-gray-800",
                    "md:divide-y-0 md:divide-x md:divide-border/80",
                    hasBuyNowJob ? "md:grid-cols-3" : "md:grid-cols-2"
                  )}
                >
                  <div
                    className={cn(
                      "flex min-h-[5.25rem] flex-col justify-center gap-1 px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6",
                      showEndedListingVisual
                        ? "bg-red-950/20 dark:bg-red-950/35"
                        : "bg-emerald-500/[0.06] dark:bg-emerald-950/30"
                    )}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                      Current lowest bid
                    </p>
                    <p
                      className={cn(
                        "text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
                        showEndedListingVisual
                          ? "text-muted-foreground line-through decoration-red-500/80 decoration-2 dark:text-gray-500"
                          : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {formatCents(effectiveCurrentLowestCents)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex min-h-[5.25rem] flex-col justify-center gap-1 px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6",
                      showEndedListingVisual ? "bg-muted/50 dark:bg-red-950/30" : "bg-card dark:bg-gray-950/40"
                    )}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                      Starting bid
                    </p>
                    <p
                      className={cn(
                        "text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
                        showEndedListingVisual
                          ? "text-muted-foreground line-through decoration-red-500/80 decoration-2 dark:text-gray-500"
                          : "text-foreground dark:text-gray-100"
                      )}
                    >
                      {formatCents(startingCents)}
                    </p>
                  </div>
                  {hasBuyNowJob && (
                    <div
                      className={cn(
                        "flex min-h-[5.25rem] flex-col justify-center gap-1 px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6",
                        showEndedListingVisual
                          ? "bg-red-950/15 dark:bg-red-950/40"
                          : "bg-violet-500/[0.07] dark:bg-violet-950/35"
                      )}
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                        Buy now
                      </p>
                      <p
                        className={cn(
                          "text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
                          showEndedListingVisual
                            ? "text-muted-foreground line-through decoration-red-500/80 decoration-2 dark:text-gray-500"
                            : "text-violet-700 dark:text-violet-300"
                        )}
                      >
                        {formatCents(buyNowCentsJob!)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!listerCompletedBoostTidy && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Info className="h-5 w-5 shrink-0" aria-hidden />
                    Property
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground dark:text-gray-400">
                    {beds != null && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground dark:text-gray-200">
                        <Bed className="h-4 w-4 shrink-0" aria-hidden />
                        {beds} bed
                      </span>
                    )}
                    {baths != null && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground dark:text-gray-200">
                        <Bath className="h-4 w-4 shrink-0" aria-hidden />
                        {baths} bath
                      </span>
                    )}
                    {propertyType && (
                      <Badge variant="secondary" className="capitalize">
                        {propertyType.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </div>
                  {(conditionLabel ||
                    levelsLabel ||
                    (typeof listing.duration_days === "number" && listing.duration_days > 0)) && (
                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {conditionLabel && (
                        <div className="min-w-0 space-y-1">
                          <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                            Condition
                          </dt>
                          <dd className="text-sm leading-snug text-foreground dark:text-gray-100">{conditionLabel}</dd>
                        </div>
                      )}
                      {levelsLabel && (
                        <div className="min-w-0 space-y-1">
                          <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                            Levels
                          </dt>
                          <dd className="text-sm leading-snug text-foreground dark:text-gray-100">{levelsLabel}</dd>
                        </div>
                      )}
                      {typeof listing.duration_days === "number" && listing.duration_days > 0 && (
                        <div className="min-w-0 space-y-1">
                          <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                            Auction listing period
                          </dt>
                          <dd className="text-sm font-semibold tabular-nums text-foreground dark:text-gray-100">
                            {listing.duration_days} days
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}
                  {addonsList.length > 0 && (
                    <div className="border-t border-border pt-4 dark:border-gray-800">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                        Add-ons
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {addonsList.map((a) => (
                          <Badge
                            key={a}
                            variant="outline"
                            title={
                              isListingAddonSpecialArea(listing, a)
                                ? "Special area (from listing)"
                                : "Paid add-on"
                            }
                            className={cn(
                              "font-normal",
                              isListingAddonSpecialArea(listing, a)
                                ? "border-amber-500/75 bg-amber-500/[0.14] text-amber-950 shadow-sm dark:border-amber-400/55 dark:bg-amber-950/45 dark:text-amber-50"
                                : "capitalize"
                            )}
                          >
                            {isListingAddonSpecialArea(listing, a) ? (
                              <span className="font-semibold tracking-wide">Special area · </span>
                            ) : null}
                            <span className="capitalize">
                              {formatListingAddonDisplayName(a)}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(moveOutRaw || showPreferredFallbackList) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-5 w-5 shrink-0" aria-hidden />
                      Dates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-5 text-sm md:grid-cols-2 md:gap-6 lg:gap-8">
                      {moveOutRaw && (
                        <div className="min-w-0 space-y-1">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                            Move-out
                          </p>
                          <p className="text-base font-semibold tabular-nums text-foreground dark:text-gray-100">
                            {moveOutDisplay}
                          </p>
                        </div>
                      )}
                      {showPreferredFromMoveOut && (
                        <div
                          className={
                            moveOutRaw
                              ? "min-w-0 space-y-2 md:border-l md:border-border md:pl-6 dark:md:border-gray-800"
                              : "min-w-0 space-y-2"
                          }
                        >
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                            Preferred cleaning window
                          </p>
                          <p className="text-base font-semibold tabular-nums text-foreground dark:text-gray-100">
                            {preferredWindowFromMoveOut}
                          </p>
                          <p className="text-xs leading-snug text-muted-foreground dark:text-gray-500">
                            Target window starts 5 days before your move-out date.
                          </p>
                        </div>
                      )}
                      {showPreferredFallbackList && (
                        <div
                          className={
                            moveOutRaw
                              ? "min-w-0 space-y-2 md:border-l md:border-border md:pl-6 dark:md:border-gray-800"
                              : "min-w-0 space-y-2"
                          }
                        >
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                            Preferred cleaning window
                          </p>
                          <ul className="space-y-1.5 text-foreground dark:text-gray-200">
                            {preferredDatesFormatted.map((d, i) => (
                              <li key={`${d}-${i}`} className="flex gap-2 text-sm">
                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                                <span className="tabular-nums">{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-xl leading-tight md:text-2xl">About this listing</CardTitle>
                    {isLive && !hideCleanerCancelledAuctionUi ? (
                      <Badge className="shrink-0">Live</Badge>
                    ) : hasActiveJob ? (
                      <Badge variant="secondary" className="shrink-0">
                        Job · {jobHeroStatusLabel}
                      </Badge>
                    ) : pendingAutoAssignWinner ? (
                      <Badge className="shrink-0 border-0 bg-sky-600 text-white">Finalising</Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="shrink-0 font-semibold uppercase tracking-wide"
                      >
                        Not live
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {specialInstructionsBody.trim() && (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 dark:border-amber-800/40 dark:bg-amber-950/25">
                      <h3 className="mb-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
                        Special instructions
                      </h3>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-950/90 dark:text-amber-50/95">
                        {specialInstructionsBody}
                      </p>
                    </div>
                  )}
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Property description</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground dark:text-gray-200">
                      {listingPropertyDescriptionBody(listing) || "No property description provided."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
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
          {!detailUiBoost && isListingOwner && !hasActiveJob && isLive && (
            <div className="flex justify-end">
              <ListerEndAuctionControl
                onRequestCancel={() => setShowCancelListingDialog(true)}
              />
            </div>
          )}
          {!detailUiBoost && (
            <>
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
                    onExpired={handleAuctionTimerExpired}
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
            </>
          )}
        </CardHeader>
        <CardContent
          className={cn("space-y-4", detailUiBoost && "space-y-5 px-4 sm:px-6")}
        >
          {hasActiveJob &&
            (listerName || cleanerName) &&
            !listerCompletedBoostTidy && (
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
          {!detailUiBoost &&
            hasActiveJob &&
            isJobCleaner &&
            localJobStatus !== "completed" &&
            !cleanerReviewPendingMinimal &&
            !listerReleaseFundsStep && (
              <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50/70 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/40">
                <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                  Won for
                </p>
                <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatCents(agreedAmountCents)}
                </p>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                  You will receive the full bid amount ({formatCents(agreedAmountCents)}). The lister pays
                  the platform fee separately.
                </p>
              </div>
            )}
          {!detailUiBoost &&
            hasActiveJob &&
            isJobLister &&
            localJobStatus !== "completed" &&
            !listerReleaseFundsStep && (
              <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50/70 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/40">
                <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">Won for</p>
                <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatCents(agreedAmountCents)}
                </p>
              </div>
            )}
          {hasActiveJob && !listerCompletedBoostTidy && (
            <JobProgressTimeline
              detailUiBoost={detailUiBoost}
              localJobStatus={localJobStatus}
              hasActiveJob={!!hasActiveJob}
              hasPaymentHold={!!hasPaymentHold}
              allCompleted={!!allCompleted}
              hasAfterPhotos={!!hasAfterPhotos}
              isJobLister={!!isJobLister}
              isJobCleaner={!!isJobCleaner}
            />
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
                  {isJobLister && !listerCompletedBoostTidy && (
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
                  {!detailUiBoost && !isJobLister && !isJobCleaner && (
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
                !listerReleaseFundsStep &&
                !isJobCleaner &&
                !isJobLister &&
                !detailUiBoost && (
                <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50/70 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/40">
                  <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                    Won for
                  </p>
                  <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                    {formatCents(agreedAmountCents)}
                  </p>
                </div>
                )
              )}
              {/* Platform fee breakdown handled above; avoid duplicating copy here. */}
            </>
          ) : hideCleanerCancelledAuctionUi ? (
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              This listing is no longer accepting bids.
            </p>
          ) : !detailUiBoost && isListingOwner && !isCleaner ? (
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
                    {effectiveCurrentLowestCents < listing.buy_now_cents && (
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
                  {formatCents(effectiveCurrentLowestCents)}
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
          ) : !detailUiBoost ? (
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
                  {formatCents(effectiveCurrentLowestCents)}
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
                  {effectiveCurrentLowestCents < listing.buy_now_cents && (
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
          ) : null}

          {bondGuideline &&
            !cleanerReviewPendingMinimal &&
            !listerReleaseFundsStep &&
            !listerCompletedBoostTidy && (
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
            <div className="mt-2 space-y-3 text-xs sm:text-sm">
              {isJobLister && !hasPaymentHold && agreedAmountCents > 0 && (
                <JobPaymentBreakdown
                  agreedAmountCents={agreedAmountCents}
                  feePercentage={feePercentage}
                  isStripeTestMode={isStripeTestMode}
                  variant="pay"
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/40">
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
                      : (
                        <>
                          The lister is reviewing and confirming the job. When chat is available, use{" "}
                          <Link
                            href={jobId ? `/messages?job=${encodeURIComponent(jobId)}` : "/messages"}
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            Messages
                          </Link>{" "}
                          to coordinate.
                        </>
                      )}
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
                        scheduleRouterAction(() => router.refresh());
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
              <DialogFooter className="gap-2 sm:gap-3">
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
                        scheduleRouterAction(() => router.refresh());
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
            !listerCompletedBoostTidy &&
            (localJobStatus === "in_progress" ||
              localJobStatus === "completed" ||
              localJobStatus === "completed_pending_approval") &&
            numericJobId && (
            <JobHistoryCollapsible enabled={false}>
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
                  !listerCompletedBoostTidy && (
                  <p
                    className={cn(
                      "mt-1 rounded-md bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
                      detailUiBoost ? "text-sm leading-relaxed" : "text-[11px]"
                    )}
                  >
                    Payment has been released. Thanks for completing this bond clean through Bond Back.
                  </p>
                  )
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
                    <div
                      id="job-after-photos"
                      className="mt-3 scroll-mt-24 rounded-2xl border border-emerald-400/50 bg-gradient-to-br from-emerald-50/90 to-transparent px-4 py-4 dark:border-emerald-800 dark:from-emerald-950/40 sm:px-5"
                    >
                      <p className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                        After photos from your cleaner
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-emerald-800 dark:text-emerald-200">
                        {localJobStatus === "completed"
                          ? "Saved from when the job was completed."
                          : "Review the after photos before you finalize and release funds."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {afterPhotoEntries.map((entry, idx) => (
                          <div
                            key={entry.name}
                            className="relative h-20 w-24 overflow-hidden rounded-md border bg-muted/40 cursor-pointer dark:border-gray-700 dark:bg-gray-800/60 group"
                            onClick={() =>
                              setPhotoLightbox({
                                urls: afterPhotoEntries.map((e) => e.url),
                                index: idx,
                                ariaLabel: "After photos",
                              })
                            }
                          >
                            <Image
                              src={entry.url}
                              alt="After clean"
                              fill
                              sizes={NEXT_IMAGE_SIZES_THUMB_GRID}
                              quality={75}
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
                <div
                  id="job-after-photos"
                  className="mt-4 scroll-mt-24 space-y-3 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-transparent px-4 py-4 dark:border-violet-900/40 dark:from-violet-950/30 sm:px-5"
                >
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
                      {afterPhotoEntries.map((entry, idx) => (
                          <div
                            key={entry.name}
                            className="relative h-20 w-24 overflow-hidden rounded-md border border-border bg-muted/40 dark:border-gray-700 dark:bg-gray-800/60 cursor-pointer group"
                            onClick={() =>
                              setPhotoLightbox({
                                urls: afterPhotoEntries.map((e) => e.url),
                                index: idx,
                                ariaLabel: "After photos",
                              })
                            }
                          >
                            <Image
                              src={entry.url}
                              alt="After clean"
                              fill
                              sizes={NEXT_IMAGE_SIZES_THUMB_GRID}
                              quality={75}
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
                              try {
                                const compressed = await compressImage(f);
                                const header = await checkImageHeader(compressed);
                                if (!header.valid) {
                                  toast({
                                    variant: "destructive",
                                    title: "Photo validation",
                                    description: `${f.name}: ${header.error}`,
                                  });
                                  continue;
                                }
                                withHeaderCheck.push(compressed);
                              } catch {
                                toast({
                                  variant: "destructive",
                                  title: "Couldn’t prepare photo",
                                  description: `${f.name}: try another image.`,
                                });
                              }
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
                                  const newCount = entries.filter(
                                    (file) => file.name && !file.name.startsWith("thumb_")
                                  ).length;
                                  if (newCount >= 3 && existingCount < 3) {
                                    void import("@/lib/actions/notifications").then(
                                      ({ notifyListerAfterPhotosReady }) =>
                                        notifyListerAfterPhotosReady(numericJobId)
                                    );
                                  }
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
                    <div
                      id="job-mark-complete"
                      className="scroll-mt-24 space-y-2 border-t border-violet-500/10 pt-4 dark:border-violet-900/30"
                    >
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
            </JobHistoryCollapsible>
          )}
          {hasActiveJob &&
            isJobLister &&
            (localJobStatus === "in_progress" ||
              localJobStatus === "completed_pending_approval") && (
              <div id="job-approve-release" className="scroll-mt-24 space-y-3">
                {agreedAmountCents > 0 && (
                  <JobPaymentBreakdown
                    agreedAmountCents={agreedAmountCents}
                    feePercentage={feePercentage}
                    isStripeTestMode={isStripeTestMode}
                    variant="release"
                  />
                )}
                <div className="space-y-2 rounded-lg border border-border/70 bg-background/80 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/40 sm:px-4">
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
                {localJobStatus === "completed_pending_approval" &&
                  autoReleaseAt &&
                  autoReleaseMsLeft != null &&
                  autoReleaseMsLeft > 0 && (
                    <Progress value={autoReleaseProgressValue} className="h-2" />
                  )}
                <p className="text-[11px] leading-snug text-muted-foreground dark:text-gray-400 sm:text-xs">
                  {localJobStatus === "completed_pending_approval"
                    ? "Review after-photos, then release or raise a dispute. A dispute pauses auto-release until it is resolved."
                    : `After the cleaner requests payment, you have ${autoReleaseHours} hours to approve or dispute once after-photos are in.`}
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
                    {!hasAfterPhotos &&
                      (localJobStatus === "completed_pending_approval" ||
                        localJobStatus === "in_progress") && (
                      <div id="job-after-photos" className="scroll-mt-24 space-y-2">
                        {localJobStatus === "completed_pending_approval" && (
                          <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                            Waiting for after photos to release funds. You can still open a dispute; that pauses auto-release.
                          </p>
                        )}
                        {localJobStatus === "in_progress" && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300">
                            Waiting for after photos to be uploaded…
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                        {hasAfterPhotos && allCompleted && (
                          <Button
                            type="button"
                            size="lg"
                            disabled={!allCompleted || !hasAfterPhotos || isFinalizing}
                            onClick={() => setShowApproveReleaseConfirm(true)}
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
                                scheduleRouterAction(() => router.refresh());
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
              </div>
            )}

          <Dialog
            open={showApproveReleaseConfirm}
            onOpenChange={(open) => {
              if (!isFinalizing) setShowApproveReleaseConfirm(open);
            }}
          >
            <DialogContent className="dark:border-gray-700 dark:bg-gray-900 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Release funds to the cleaner?</DialogTitle>
                <DialogDescription className="text-left">
                  This will pay{" "}
                  <span className="font-semibold text-foreground">
                    {formatCents(agreedAmountCents)}
                  </span>{" "}
                  to the cleaner (you already paid any platform fee when securing the job). The cleaner will
                  be notified. This action cannot be undone here.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowApproveReleaseConfirm(false)}
                  disabled={isFinalizing}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                  disabled={isFinalizing}
                  onClick={handleFinalizePayment}
                >
                  {isFinalizing ? "Releasing…" : "Yes, release funds"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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

          {!cleanerReviewPendingMinimal && !listerReleaseFundsStep && (
            <>
          {!detailUiBoost && specialInstructionsBody.trim() && (
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
                {specialInstructionsBody}
              </p>
            </div>
          )}
          {!detailUiBoost &&
            listing.addons &&
            Array.isArray(listing.addons) &&
            listing.addons.length > 0 && (
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
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1 dark:text-gray-200",
                      isListingAddonSpecialArea(listing, addon)
                        ? "border border-amber-500/60 bg-amber-500/[0.12] text-amber-950 dark:border-amber-400/50 dark:bg-amber-950/50 dark:text-amber-100"
                        : "bg-muted dark:bg-gray-700/60"
                    )}
                  >
                    <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    {isListingAddonSpecialArea(listing, addon) ? (
                      <span className="font-semibold">Special area · </span>
                    ) : null}
                    <span className="capitalize">
                      {formatListingAddonDisplayName(addon)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
              {!listerCompletedBoostTidy && (
                <JobDetailInitialConditionPhotos
                  listing={listing}
                  listingId={listingId}
                  detailUiBoost={detailUiBoost}
                  initialPhotosLoading={initialPhotosLoading}
                  initialPhotoEntries={initialPhotoEntries}
                  setInitialPhotoEntries={setInitialPhotoEntries}
                  setListing={setListing}
                  setPhotoLightbox={setPhotoLightbox}
                  supabase={supabase}
                  isJobLister={isJobLister}
                  isListingOwner={isListingOwner}
                  isCleaner={isCleaner}
                  initialPhotosUploading={initialPhotosUploading}
                  setInitialPhotosUploading={setInitialPhotosUploading}
                />
              )}
            </>
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
              className={cn(
                "max-md:hidden leading-snug",
                detailUiBoost ? "text-base" : "text-sm"
              )}
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
              listing={listingForBid}
              isCleaner={isCleaner}
              currentUserId={currentUserId}
            />

            {isCleaner &&
              listing.buy_now_cents != null &&
              listing.buy_now_cents > 0 &&
              effectiveCurrentLowestCents >= listing.buy_now_cents && (
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

      {!(isCleaner && hideCleanerCancelledAuctionUi) &&
        !cleanerReviewPendingMinimal &&
        !listerReleaseFundsStep &&
        !listerCompletedBoostTidy &&
        (detailUiBoost ? (
          <Card id="bids" className="mt-4 overflow-hidden border-border/90 shadow-sm dark:border-gray-800">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
                <Gavel className="h-5 w-5 shrink-0" aria-hidden />
                <CardTitle className="mb-0 flex flex-1 items-center gap-2 text-lg">
                  Bids
                  {bids.length > 0 ? (
                    <Badge variant="secondary" className="font-mono text-xs tabular-nums">
                      {bids.length}
                    </Badge>
                  ) : null}
                </CardTitle>
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <CardContent className="space-y-3 border-t border-border/80 px-4 pb-6 pt-4 sm:px-6 dark:border-gray-800">
                <BidHistoryTable
                  listingId={listingId}
                  bids={bids}
                  hasPendingEarlyAcceptance={bids.some(
                    (b) => b.status === "pending_confirmation"
                  )}
                  onAcceptBid={
                    isListingOwner && !hasActiveJob && isLive
                      ? handleAcceptBid
                      : undefined
                  }
                  closedAuctionBidStatus={closedAuctionBidStatus}
                  showRevertLastBid={showRevertLastBidInHistory}
                  onRevertLastBid={
                    showRevertLastBidInHistory ? handleRevertLastBid : undefined
                  }
                  largeTouch
                />
                {isListingOwner && !hasActiveJob && isLive && (
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    {bids.length === 0 ? (
                      <>
                        When cleaners start bidding, their offers will appear in the table above. To hire
                        someone, open their row and tap <strong>Accept bid</strong> — that locks in that
                        cleaner for this job.
                      </>
                    ) : (
                      <>
                        To confirm who you want, tap <strong>Accept bid</strong> on that cleaner&apos;s row
                        in the table above.
                      </>
                    )}
                  </p>
                )}
              </CardContent>
            </details>
          </Card>
        ) : (
          <BidHistorySection
            listingId={listingId}
            bids={bids}
            hasPendingEarlyAcceptance={bids.some(
              (b) => b.status === "pending_confirmation"
            )}
            onAcceptBid={
              isListingOwner && !hasActiveJob && isLive
                ? handleAcceptBid
                : undefined
            }
            closedAuctionBidStatus={closedAuctionBidStatus}
            showRevertLastBid={showRevertLastBidInHistory}
            onRevertLastBid={
              showRevertLastBidInHistory ? handleRevertLastBid : undefined
            }
            largeTouch={detailUiBoost}
            defaultOpen={false}
            className={cn(
              "mt-4 border-t border-border pt-4 text-muted-foreground dark:border-gray-700 dark:text-gray-500",
              detailUiBoost ? "text-sm" : "text-[11px]"
            )}
          />
        ))}

      {showMessengerUnlockedBanner && (
        <section
          aria-label="Messenger chat unlocked"
          className={cn(
            "overflow-hidden rounded-2xl border border-sky-300/70 bg-gradient-to-br from-sky-50 via-white to-blue-50/90 shadow-md ring-1 ring-sky-200/40 dark:border-sky-800/60 dark:from-sky-950/50 dark:via-gray-950 dark:to-blue-950/40 dark:ring-sky-900/30",
            detailUiBoost && "mx-auto w-full max-w-4xl"
          )}
        >
          <div className="relative px-5 py-6 sm:px-7 sm:py-7">
            <div
              className="pointer-events-none absolute -right-6 -top-6 flex gap-1 opacity-[0.12] dark:opacity-[0.18]"
              aria-hidden
            >
              <Unlock className="h-16 w-16 rotate-12 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <div className="min-w-0 flex gap-4">
                <div className="relative flex shrink-0">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15 shadow-inner dark:bg-sky-500/20">
                    <Unlock className="h-7 w-7 text-sky-700 dark:text-sky-300" aria-hidden />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 shadow-sm dark:bg-gray-900/90">
                    <LockOpen className="h-3 w-3 text-sky-600 dark:text-sky-400" aria-hidden />
                    <LockOpen className="h-3 w-3 text-sky-500 dark:text-sky-500" aria-hidden />
                  </div>
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-800/90 dark:text-sky-300/95">
                    Messenger
                  </p>
                  <h2 className="text-balance text-lg font-bold tracking-tight text-sky-950 dark:text-sky-50 sm:text-xl">
                    Chat is unlocked — message your job partner
                  </h2>
                  <p className="max-w-prose text-sm leading-relaxed text-sky-900/85 dark:text-sky-100/85">
                    Your private job thread is open. Use it to coordinate access, timing, photos, and anything else
                    for this clean.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center lg:flex-col xl:flex-row">
                <Button
                  asChild
                  className="min-h-11 w-full min-w-[200px] bg-blue-600 font-semibold text-white shadow-md hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 sm:w-auto"
                >
                  <Link href={`/messages?job=${encodeURIComponent(jobId!)}`}>
                    Open Messages
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {listerCompletedBoostTidy && hasActiveJob && numericJobId && (
        <JobHistoryCollapsible enabled title="Job History Details">
          <div className="space-y-4 rounded-xl border border-border/80 bg-card px-3 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-950/40 sm:px-4 sm:py-4">
            <Card className="overflow-hidden border-border/90 shadow-sm dark:border-gray-800">
              <CardContent className="p-0">
                <div
                  className={cn(
                    "grid grid-cols-1 divide-y divide-border dark:divide-gray-800",
                    "md:divide-y-0 md:divide-x md:divide-border/80",
                    showCleanerWonForCallout
                      ? hasBuyNowJob
                        ? "md:grid-cols-2"
                        : "md:grid-cols-1"
                      : hasBuyNowJob
                        ? "md:grid-cols-3"
                        : "md:grid-cols-2"
                  )}
                >
                  {!showCleanerWonForCallout && (
                    <div className="flex min-h-[5.25rem] flex-col justify-center gap-1 bg-emerald-500/[0.06] px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6 dark:bg-emerald-950/30">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                        Job amount (paid)
                      </p>
                      <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                        {formatCents(agreedAmountCents)}
                      </p>
                    </div>
                  )}
                  <div className="flex min-h-[5.25rem] flex-col justify-center gap-1 bg-card px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6 dark:bg-gray-950/40">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                      Starting bid
                    </p>
                    <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground dark:text-gray-100 sm:text-3xl">
                      {formatCents(startingCents)}
                    </p>
                  </div>
                  {hasBuyNowJob && (
                    <div className="flex min-h-[5.25rem] flex-col justify-center gap-1 bg-violet-500/[0.07] px-5 py-4 sm:px-6 md:min-h-[6rem] md:px-8 md:py-6 dark:bg-violet-950/35">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/95 dark:text-gray-400">
                        Buy now
                      </p>
                      <p className="text-2xl font-bold tabular-nums tracking-tight text-violet-700 dark:text-violet-300 sm:text-3xl">
                        {formatCents(buyNowCentsJob!)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            {showCleanerWonForCallout && (
              <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50/70 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/40">
                <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">Won for</p>
                <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatCents(agreedAmountCents)}
                </p>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                  You will receive the full bid amount ({formatCents(agreedAmountCents)}). The lister pays the
                  platform fee separately.
                </p>
              </div>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Info className="h-5 w-5 shrink-0" aria-hidden />
                  Property
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground dark:text-gray-400">
                  {beds != null && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground dark:text-gray-200">
                      <Bed className="h-4 w-4 shrink-0" aria-hidden />
                      {beds} bed
                    </span>
                  )}
                  {baths != null && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground dark:text-gray-200">
                      <Bath className="h-4 w-4 shrink-0" aria-hidden />
                      {baths} bath
                    </span>
                  )}
                  {propertyType && (
                    <Badge variant="secondary" className="capitalize">
                      {propertyType.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
                {(conditionLabel ||
                  levelsLabel ||
                  (typeof listing.duration_days === "number" && listing.duration_days > 0)) && (
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {conditionLabel && (
                      <div className="min-w-0 space-y-1">
                        <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                          Condition
                        </dt>
                        <dd className="text-sm leading-snug text-foreground dark:text-gray-100">{conditionLabel}</dd>
                      </div>
                    )}
                    {levelsLabel && (
                      <div className="min-w-0 space-y-1">
                        <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                          Levels
                        </dt>
                        <dd className="text-sm leading-snug text-foreground dark:text-gray-100">{levelsLabel}</dd>
                      </div>
                    )}
                    {typeof listing.duration_days === "number" && listing.duration_days > 0 && (
                      <div className="min-w-0 space-y-1">
                        <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                          Auction listing period
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground dark:text-gray-100">
                          {listing.duration_days} days
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
                {addonsList.length > 0 && (
                  <div className="border-t border-border pt-4 dark:border-gray-800">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                      Add-ons
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {addonsList.map((a) => (
                        <Badge
                          key={a}
                          variant="outline"
                          title={
                            isListingAddonSpecialArea(listing, a)
                              ? "Special area (from listing)"
                              : "Paid add-on"
                          }
                          className={cn(
                            "font-normal",
                            isListingAddonSpecialArea(listing, a)
                              ? "border-amber-500/75 bg-amber-500/[0.14] text-amber-950 shadow-sm dark:border-amber-400/55 dark:bg-amber-950/45 dark:text-amber-50"
                              : "capitalize"
                          )}
                        >
                          {isListingAddonSpecialArea(listing, a) ? (
                            <span className="font-semibold tracking-wide">Special area · </span>
                          ) : null}
                          <span className="capitalize">{formatListingAddonDisplayName(a)}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            {(moveOutRaw || showPreferredFallbackList) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5 shrink-0" aria-hidden />
                    Dates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-5 text-sm md:grid-cols-2 md:gap-6 lg:gap-8">
                    {moveOutRaw && (
                      <div className="min-w-0 space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                          Move-out
                        </p>
                        <p className="text-base font-semibold tabular-nums text-foreground dark:text-gray-100">
                          {moveOutDisplay}
                        </p>
                      </div>
                    )}
                    {showPreferredFromMoveOut && (
                      <div
                        className={
                          moveOutRaw
                            ? "min-w-0 space-y-2 md:border-l md:border-border md:pl-6 dark:md:border-gray-800"
                            : "min-w-0 space-y-2"
                        }
                      >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                          Preferred cleaning window
                        </p>
                        <p className="text-base font-semibold tabular-nums text-foreground dark:text-gray-100">
                          {preferredWindowFromMoveOut}
                        </p>
                        <p className="text-xs leading-snug text-muted-foreground dark:text-gray-500">
                          Target window starts 5 days before your move-out date.
                        </p>
                      </div>
                    )}
                    {showPreferredFallbackList && (
                      <div
                        className={
                          moveOutRaw
                            ? "min-w-0 space-y-2 md:border-l md:border-border md:pl-6 dark:md:border-gray-800"
                            : "min-w-0 space-y-2"
                        }
                      >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                          Preferred cleaning window
                        </p>
                        <ul className="space-y-1.5 text-foreground dark:text-gray-200">
                          {preferredDatesFormatted.map((d, i) => (
                            <li key={`${d}-${i}`} className="flex gap-2 text-sm">
                              <span
                                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60"
                                aria-hidden
                              />
                              <span className="tabular-nums">{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="text-xl leading-tight md:text-2xl">About this listing</CardTitle>
                  <Badge variant="secondary" className="shrink-0">
                    Job · {jobHeroStatusLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {specialInstructionsBody.trim() && (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 dark:border-amber-800/40 dark:bg-amber-950/25">
                    <h3 className="mb-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
                      Special instructions
                    </h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-950/90 dark:text-amber-50/95">
                      {specialInstructionsBody}
                    </p>
                  </div>
                )}
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Property description</h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground dark:text-gray-200">
                    {listingPropertyDescriptionBody(listing) || "No property description provided."}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-border/90 shadow-sm dark:border-gray-800">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 [&::-webkit-details-marker]:hidden">
                  <Gavel className="h-5 w-5 shrink-0" aria-hidden />
                  <CardTitle className="mb-0 flex flex-1 items-center gap-2 text-lg">
                    Bids
                    {bids.length > 0 ? (
                      <Badge variant="secondary" className="font-mono text-xs tabular-nums">
                        {bids.length}
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <CardContent className="space-y-3 border-t border-border/80 pt-4 dark:border-gray-800">
                  <BidHistoryTable
                    listingId={listingId}
                    bids={bids}
                    hasPendingEarlyAcceptance={bids.some((b) => b.status === "pending_confirmation")}
                    onAcceptBid={
                      isListingOwner && !hasActiveJob && isLive ? handleAcceptBid : undefined
                    }
                    closedAuctionBidStatus={closedAuctionBidStatus}
                    showRevertLastBid={showRevertLastBidInHistory}
                    onRevertLastBid={showRevertLastBidInHistory ? handleRevertLastBid : undefined}
                    largeTouch
                  />
                </CardContent>
              </details>
            </Card>
            <JobDetailInitialConditionPhotos
              listing={listing}
              listingId={listingId}
              detailUiBoost={detailUiBoost}
              initialPhotosLoading={initialPhotosLoading}
              initialPhotoEntries={initialPhotoEntries}
              setInitialPhotoEntries={setInitialPhotoEntries}
              setListing={setListing}
              setPhotoLightbox={setPhotoLightbox}
              supabase={supabase}
              isJobLister={isJobLister}
              isListingOwner={isListingOwner}
              isCleaner={isCleaner}
              initialPhotosUploading={initialPhotosUploading}
              setInitialPhotosUploading={setInitialPhotosUploading}
            />
          </div>
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
                {completedDateLabel ? `(Completed ${completedDateLabel})` : "(Completed)"}
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
          <p
            className={cn(
              "mt-1 rounded-md bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
              detailUiBoost ? "text-sm leading-relaxed" : "text-[11px]"
            )}
          >
            Payment has been released. Thanks for completing this bond clean through Bond Back.
          </p>
          {isJobLister && afterPhotoEntries.length > 0 && (
            <div
              id="job-after-photos"
              className="mt-3 scroll-mt-24 rounded-2xl border border-emerald-400/50 bg-gradient-to-br from-emerald-50/90 to-transparent px-4 py-4 dark:border-emerald-800 dark:from-emerald-950/40 sm:px-5"
            >
              <p className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                After photos from your cleaner
              </p>
              <p className="mt-2 text-sm leading-relaxed text-emerald-800 dark:text-emerald-200">
                Saved from when the job was completed.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {afterPhotoEntries.map((entry, idx) => (
                  <div
                    key={entry.name}
                    className="relative h-20 w-24 cursor-pointer overflow-hidden rounded-md border bg-muted/40 group dark:border-gray-700 dark:bg-gray-800/60"
                    onClick={() =>
                      setPhotoLightbox({
                        urls: afterPhotoEntries.map((e) => e.url),
                        index: idx,
                        ariaLabel: "After photos",
                      })
                    }
                  >
                    <Image
                      src={entry.url}
                      alt="After clean"
                      fill
                      sizes={NEXT_IMAGE_SIZES_THUMB_GRID}
                      quality={75}
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
          {(listerName || cleanerName) && (
            <div
              className={cn(
                "mt-4 border-t border-border pt-4 text-muted-foreground dark:border-gray-700 dark:text-gray-400",
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
          {bondGuideline && (
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
        </JobHistoryCollapsible>
      )}

      <ImageLightboxGallery
        open={photoLightbox != null}
        urls={photoLightbox?.urls ?? []}
        initialIndex={photoLightbox?.index ?? 0}
        onClose={() => setPhotoLightbox(null)}
        ariaLabel={photoLightbox?.ariaLabel ?? "Enlarged photos"}
      />
    </div>
  );
}

function BidHistorySection({
  listingId,
  bids,
  hasPendingEarlyAcceptance = false,
  onAcceptBid,
  closedAuctionBidStatus = null,
  showRevertLastBid = false,
  onRevertLastBid,
  className,
  largeTouch = false,
  /** Collapsed until the user opens the section (job / listing detail). */
  defaultOpen = false,
}: {
  listingId: string;
  bids: BidWithBidder[];
  hasPendingEarlyAcceptance?: boolean;
  onAcceptBid?: (bid: BidWithBidder) => Promise<void>;
  closedAuctionBidStatus?: ClosedAuctionBidStatus | null;
  /** Cleaner + live listing: withdraw most recent bid by this user. */
  showRevertLastBid?: boolean;
  onRevertLastBid?: () => Promise<void>;
  className?: string;
  /** Larger summary + body copy (cleaner or lister job detail). */
  largeTouch?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className={cn("group", className)}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none select-none items-center gap-2 rounded-xl py-2 font-medium text-foreground hover:bg-muted/50 dark:text-gray-100 dark:hover:bg-gray-800/70 [&::-webkit-details-marker]:hidden",
          largeTouch ? "min-h-14 text-base sm:text-lg" : "min-h-11 text-sm"
        )}
      >
        <Gavel className="h-4 w-4 shrink-0 opacity-80 sm:h-5 sm:w-5" aria-hidden />
        <span className="flex flex-1 items-center gap-2">
          Bids
          {bids.length > 0 ? (
            <Badge variant="secondary" className="font-mono text-[10px] tabular-nums sm:text-xs">
              {bids.length}
            </Badge>
          ) : null}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 sm:h-5 sm:w-5"
          aria-hidden
        />
      </summary>
      {bids.length > 0 ? (
        <div className="mt-2 space-y-3">
          <BidHistoryTable
            listingId={listingId}
            bids={bids}
            onAcceptBid={onAcceptBid}
            hasPendingEarlyAcceptance={hasPendingEarlyAcceptance}
            closedAuctionBidStatus={closedAuctionBidStatus}
            showRevertLastBid={showRevertLastBid}
            onRevertLastBid={onRevertLastBid}
            largeTouch={largeTouch}
          />
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
