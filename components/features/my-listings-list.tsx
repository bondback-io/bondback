"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, MessageCircle, Gavel } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CountdownTimer } from "@/components/features/countdown-timer";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { formatCents, getListingCoverUrl } from "@/lib/listings";
import { parseUtcTimestamp } from "@/lib/utils";
import { format } from "date-fns";
import type { ListingRow } from "@/lib/listings";
import { cancelListing, updateListingDetails } from "@/lib/actions/listings";
import { useToast } from "@/components/ui/use-toast";
import {
  validatePhotoFiles,
  PHOTO_LIMITS,
  PHOTO_VALIDATION,
  checkImageHeader,
} from "@/lib/photo-validation";
import { uploadProcessedPhotos } from "@/lib/actions/upload-photos";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { formatAuctionTimeLeftShort } from "@/components/JobCard";
import { MyListingsCardMobile } from "@/components/features/my-listings-card-mobile";

export type MyListingsListProps = {
  initialListings: ListingRow[];
  listerId: string;
  /** Logged-in lister's verification badges (same chips as marketplace cards) */
  listerVerificationBadges?: string[] | null;
  /** When set, open the edit panel for this listing id (e.g. from /listings/[id]/edit redirect). */
  initialEditListingId?: string | null;
  /** Platform fee % (lister pays on top of job price). Used for fee breakdown on job cards. */
  feePercentage?: number;
  /** Optional top-level view filter from My Listings tabs. */
  viewTab?:
    | "active_listings"
    | "completed_jobs"
    | "pending_payments"
    | "cancelled_listings"
    | "disputes";
  /** From server: avoids cancelled listings flashing as “live” before client job fetch. */
  initialActiveJobsSnapshot?: Record<
    string,
    {
      jobId: string | number;
      winnerId: string | null;
      winnerName: string;
      status: string | null;
      cleanerConfirmedComplete?: boolean | null;
      cleanerConfirmedAt?: string | null;
      updatedAt?: string | null;
    }
  >;
  initialActiveListingIds?: (string | number)[];
};

export function MyListingsList({
  initialListings,
  listerId,
  initialEditListingId = null,
  feePercentage = 12,
  viewTab = "active_listings",
  initialActiveJobsSnapshot,
  initialActiveListingIds,
  listerVerificationBadges = null,
}: MyListingsListProps) {
  const [listings, setListings] = useState<ListingRow[]>(initialListings);
  const [activeListingIds, setActiveListingIds] = useState<
    (string | number)[]
  >(() => initialActiveListingIds ?? []);
  const [activeJobs, setActiveJobs] = useState<
    Record<
      string | number,
      {
        jobId: number | string;
        winnerId: string | null;
        winnerName: string;
        status: string | null;
        cleanerConfirmedComplete?: boolean | null;
        cleanerConfirmedAt?: string | null;
        updatedAt?: string | null;
      }
    >
  >(() => {
    const snap = initialActiveJobsSnapshot;
    if (!snap) return {};
    const out: Record<
      string | number,
      {
        jobId: number | string;
        winnerId: string | null;
        winnerName: string;
        status: string | null;
        cleanerConfirmedComplete?: boolean | null;
        cleanerConfirmedAt?: string | null;
        updatedAt?: string | null;
      }
    > = {};
    for (const l of initialListings) {
      const row = snap[String(l.id)];
      if (row) {
        out[l.id as string | number] = row;
      }
    }
    return out;
  });
  const [bidListingIds, setBidListingIds] = useState<(string | number)[]>([]);
  const [editing, setEditing] = useState<ListingRow | null>(null);
  const [editPhotoUrls, setEditPhotoUrls] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const openedForEditIdRef = useRef<string | null>(null);

  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    const channel = supabase
      .channel("my-listings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listings",
          filter: `lister_id=eq.${listerId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setListings((prev) => [payload.new as ListingRow, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as ListingRow;
            setListings((prev) =>
              prev.map((l) => (l.id === row.id ? row : l))
            );
          } else if (payload.eventType === "DELETE") {
            setListings((prev) => prev.filter((l) => l.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, listerId]);

  // Fetch jobs for these listings so we can show an "active" status
  // when a listing has been won or purchased.
  useEffect(() => {
    if (!listings.length) return;
    const ids = listings.map((l) => l.id as unknown as string | number);
    const loadJobs = async () => {
      const { data } = await supabase
        .from("jobs")
        .select(
          "id, listing_id, winner_id, status, cleaner_confirmed_complete, cleaner_confirmed_at, updated_at"
        )
        .in("listing_id", ids as any);
      const jobs = (data ?? []) as {
        id: number | string;
        listing_id: string | number;
        winner_id: string | null;
        status: string | null;
        cleaner_confirmed_complete?: boolean | null;
        cleaner_confirmed_at?: string | null;
        updated_at?: string | null;
      }[];

      // Only treat as "taken" (active job) when status is not cancelled — cancelled jobs move back to live/ended.
      const taken = jobs
        .filter((j) => j.status !== "cancelled")
        .map((j) => j.listing_id);
      setActiveListingIds(taken);

      const winnerIds = Array.from(
        new Set(jobs.map((j) => j.winner_id).filter((id): id is string => !!id))
      );

      let winnerNames: Record<string, string> = {};
      if (winnerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", winnerIds as any);
        winnerNames = Object.fromEntries(
          (profiles ?? []).map((p: any) => [
            p.id as string,
            (p.full_name as string | null) || "Cleaner",
          ])
        );
      }

      const jobMap: Record<
        string | number,
        {
          jobId: number | string;
          winnerId: string | null;
          winnerName: string;
          status: string | null;
          cleanerConfirmedComplete?: boolean | null;
          cleanerConfirmedAt?: string | null;
          updatedAt?: string | null;
        }
      > = {};
      for (const j of jobs) {
        jobMap[j.listing_id] = {
          jobId: j.id,
          winnerId: j.winner_id,
          winnerName: j.winner_id ? winnerNames[j.winner_id] || "Cleaner" : "Cleaner",
          status: j.status,
          cleanerConfirmedComplete: j.cleaner_confirmed_complete ?? null,
          cleanerConfirmedAt: j.cleaner_confirmed_at ?? null,
          updatedAt: j.updated_at ?? null,
        };
      }
      setActiveJobs(jobMap);
    };
    loadJobs();
  }, [supabase, listings]);

  // Track listings that have at least one bid
  useEffect(() => {
    if (!listings.length) return;
    const ids = listings.map((l) => l.id as unknown as string | number);
    const loadBids = async () => {
      const { data } = await supabase
        .from("bids")
        .select("listing_id")
        .in("listing_id", ids as any);
      const withBids = Array.from(
        new Set(
          (data ?? []).map(
            (b: { listing_id: string | number }) => b.listing_id
          )
        )
      );
      setBidListingIds(withBids);
    };
    loadBids();
  }, [supabase, listings]);

  const openEditor = (listing: ListingRow) => {
    setEditing(listing);
    setEditPhotoUrls(
      Array.isArray(listing.photo_urls) ? (listing.photo_urls as string[]) : []
    );
    setEditDescription(listing.description ?? "");
    setEditError(null);
  };

  // When navigated from /listings/[id]/edit, open the editor for that listing once it's in the list.
  useEffect(() => {
    if (!initialEditListingId || listings.length === 0) return;
    if (openedForEditIdRef.current === initialEditListingId) return;
    const listing = listings.find(
      (l) => String(l.id) === String(initialEditListingId)
    );
    if (listing) {
      openedForEditIdRef.current = initialEditListingId;
      openEditor(listing);
    }
  }, [initialEditListingId, listings]);

  const closeEditor = () => {
    setEditing(null);
    setEditPhotoUrls([]);
    setEditDescription("");
    setEditError(null);
    setUploadingPhotos(false);
    setIsSaving(false);
  };

  const { toast } = useToast();

  const handleListingPhotosChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!editing) return;
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const incoming = Array.from(files);
    const { validFiles, errors } = validatePhotoFiles(incoming, {
      maxFiles: PHOTO_LIMITS.LISTING_EDIT,
      existingCount: editPhotoUrls.length,
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

    setUploadingPhotos(true);
    setEditError(null);
    try {
      const fd = new FormData();
      withHeaderCheck.forEach((f) => fd.append("files", f));
      const pathPrefix = `user-${listerId}/listing-${editing.id}`;
      const { results, error: actionError } = await uploadProcessedPhotos(fd, {
        bucket: "listing-photos",
        pathPrefix,
        maxFiles: PHOTO_LIMITS.LISTING_EDIT,
        existingCount: editPhotoUrls.length,
        generateThumb: true,
      });
      if (actionError) {
        toast({ variant: "destructive", title: "Upload failed", description: actionError });
      }
      const newUrls: string[] = [];
      results.forEach((r) => {
        if (r.error) {
          toast({
            variant: "destructive",
            title: "Upload failed",
            description: `${r.fileName}: ${r.error}`,
          });
        } else if (r.url) {
          newUrls.push(r.url);
        }
      });
      const next = [...editPhotoUrls, ...newUrls].slice(0, PHOTO_LIMITS.LISTING_EDIT);
      setEditPhotoUrls(next);
      const result = await updateListingDetails(editing.id, {
        description: editDescription.trim() || null,
        photo_urls: next.length ? next : null,
      });
      if (!result.ok) {
        setEditError(result.error ?? null);
      } else {
        setListings((prev) =>
          prev.map((l) =>
            l.id === editing.id
              ? ({
                  ...l,
                  description: editDescription.trim() || null,
                  photo_urls: next.length ? next : null,
                } as ListingRow)
              : l
          )
        );
      }
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to save listing photos.");
    } finally {
      setUploadingPhotos(false);
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    setIsSaving(true);
    setEditError(null);
    const result = await updateListingDetails(editing.id, {
      description: editDescription.trim() || null,
      photo_urls: editPhotoUrls.length ? editPhotoUrls : null,
    });
    setIsSaving(false);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }

    // Update local list so UI reflects the change immediately
    setListings((prev) =>
      prev.map((l) =>
        l.id === editing.id
          ? ({
              ...l,
              description: editDescription.trim() || null,
              photo_urls: editPhotoUrls.length ? editPhotoUrls : null,
            } as ListingRow)
          : l
      )
    );
    closeEditor();
  };

  const activeIdSet = new Set<string | number>(activeListingIds);
  const bidIdSet = new Set<string | number>(bidListingIds);
  const activeListings = listings.filter((l) =>
    activeIdSet.has(l.id as unknown as string | number)
  );
  const completedListings = activeListings.filter((l) => {
    const info =
      activeJobs[l.id as unknown as string | number] ?? null;
    return info && info.status === "completed";
  });
  const activeNonCompletedListings = activeListings.filter((l) => {
    const info =
      activeJobs[l.id as unknown as string | number] ?? null;
    return !info || info.status !== "completed";
  });

  const otherListings = listings.filter(
    (l) => !activeIdSet.has(l.id as unknown as string | number)
  );
  const nowMs = Date.now();
  // Exclude listings with a cancelled job from "live" so they don't appear under Active Listings / New listings
  const cancelledJobListingIds = new Set<string | number>(
    listings
      .filter(
        (l) =>
          activeJobs[l.id as unknown as string | number]?.status === "cancelled"
      )
      .map((l) => l.id as unknown as string | number)
  );
  const liveListings = otherListings.filter(
    (l) =>
      l.status === "live" &&
      parseUtcTimestamp(l.end_time) > nowMs &&
      !cancelledJobListingIds.has(l.id as unknown as string | number)
  );
  const endedListings = otherListings.filter(
    (l) => !(l.status === "live" && parseUtcTimestamp(l.end_time) > nowMs)
  );

  const noBidLiveListings = liveListings.filter(
    (l) => !bidIdSet.has(l.id as unknown as string | number)
  );
  const liveListingsWithBids = liveListings.filter((l) =>
    bidIdSet.has(l.id as unknown as string | number)
  );
  // Only listings whose job status is "cancelled" — completed/other jobs must not appear here
  const cancelledListingIds = new Set<string | number>(
    listings
      .filter(
        (l) =>
          activeJobs[l.id as unknown as string | number]?.status === "cancelled"
      )
      .map((l) => l.id as unknown as string | number)
  );
  const cancelledListings = listings.filter((l) =>
    cancelledListingIds.has(l.id as unknown as string | number)
  );

  const DISPUTED_STATUSES = ["disputed", "in_review", "dispute_negotiating"];
  const pendingPaymentsListings = activeListings.filter((l) => {
    const info = activeJobs[l.id as unknown as string | number] ?? null;
    return (
      info?.status === "in_progress" && info?.cleanerConfirmedComplete === true
    );
  });
  const disputedListings = listings.filter((l) => {
    const status = activeJobs[l.id as unknown as string | number]?.status ?? "";
    return DISPUTED_STATUSES.includes(status);
  });

  const renderCard = (
    listing: ListingRow,
    kind: "active" | "live" | "ended" | "completed"
  ) => {
    const isJobCard = kind === "active" || kind === "completed";
    const isActiveJob = kind === "active";
    const isLive = kind === "live";
    const isEndedNoBids =
      kind === "ended" &&
      !bidIdSet.has(listing.id as unknown as string | number);
    const jobInfo =
      activeJobs[listing.id as unknown as string | number] ?? null;
    const jobStatus = (jobInfo?.status as string | null) ?? null;
    const cleanerConfirmed =
      jobInfo?.cleanerConfirmedComplete === true;
    const completedAt = jobInfo?.cleanerConfirmedAt ?? null;
    const completedDateLabel =
      completedAt != null
        ? format(new Date(completedAt), "d MMM yyyy")
        : null;
    const cancelledAt = jobInfo?.updatedAt ?? null;
    const cancelledDateLabel =
      jobStatus === "cancelled" && cancelledAt != null
        ? format(new Date(cancelledAt), "d MMM yyyy")
        : null;
    // Card cancelled state: only from job status so completed jobs never show as cancelled
    const isCancelledListing = jobStatus === "cancelled";
    const isDisputedListing =
      jobStatus === "disputed" ||
      jobStatus === "in_review" ||
      jobStatus === "dispute_negotiating";

    let statusLabel = listing.status;
    let statusClass =
      "inline-flex items-center rounded-full px-2 py-[1px] text-[11px] font-medium capitalize";
    let progressCount = 0;

    if (isJobCard) {
      // Map job state to 5-step progress, aligned with the job detail stepper:
      // 1/5 = accepted (awaiting approval)
      // 2/5 = in progress (work underway, checklist not yet confirmed)
      // 4/5 = checklist complete + photos uploaded (cleaner has confirmed)
      // 5/5 = completed (funds released)
      if (jobStatus === "accepted" || !jobStatus) {
        progressCount = 1;
      } else if (jobStatus === "in_progress" && !cleanerConfirmed) {
        progressCount = 2;
      } else if (jobStatus === "in_progress" && cleanerConfirmed) {
        progressCount = 4;
      } else if (jobStatus === "completed") {
        progressCount = 5;
      }
      // cancelled: progressCount stays 0

      switch (jobStatus) {
        case "accepted":
          statusLabel = "Active / Not yet approved";
          statusClass += " bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
          break;
        case "in_progress":
          statusLabel = "In progress";
          statusClass +=
            " bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
          break;
        case "completed":
          statusLabel = "Completed";
          statusClass +=
            " bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
          break;
        case "cancelled":
          statusLabel = "Cancelled";
          statusClass += " bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
          break;
        case "disputed":
        case "in_review":
        case "dispute_negotiating":
          statusLabel = "Disputed";
          statusClass += " bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
          break;
        default:
          statusLabel = "Active";
          statusClass +=
            " bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
          break;
      }
    } else if (isEndedNoBids) {
      statusLabel = "Ended with no bids";
      statusClass += " bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200";
    } else if (kind === "ended") {
      if (jobStatus === "cancelled" || cancelledListingIds.has(listing.id as unknown as string | number)) {
        statusLabel = "Cancelled";
        statusClass += " bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
      } else {
        statusLabel = "ended";
        statusClass += " text-muted-foreground dark:text-gray-300";
      }
    }

    let cardClass =
      "flex h-full flex-col transition-transform transition-shadow hover:-translate-y-0.5 hover:shadow-lg";
    if (isJobCard || isCancelledListing) {
      if (isCancelledListing) {
        cardClass += " border-red-200 bg-red-50/70 dark:border-red-800 dark:bg-red-950/40";
      } else if (isDisputedListing) {
        cardClass += " border-amber-200 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/40 border-l-4 border-l-amber-500";
      } else if (jobStatus === "completed") {
        cardClass += " border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500";
      } else {
        // Accent the left border by progress step for quick scanning.
        switch (progressCount) {
          case 1:
            cardClass += " border-l-4 border-l-sky-400";
            break;
          case 2:
            cardClass += " border-l-4 border-l-emerald-400";
            break;
          case 3:
            cardClass += " border-l-4 border-l-amber-400";
            break;
          case 4:
            cardClass += " border-l-4 border-l-purple-400";
            break;
          case 5:
            cardClass += " border-l-4 border-l-emerald-500";
            break;
          default:
            break;
        }
      }
    }

    const coverUrl = getListingCoverUrl(listing) ?? "/placeholder-listing.png";
    const endTsMs = parseUtcTimestamp(listing.end_time);
    const auctionHoursLeft = (endTsMs - Date.now()) / (1000 * 60 * 60);
    const showHotMobile =
      isLive &&
      listing.status === "live" &&
      !isCancelledListing &&
      auctionHoursLeft > 0 &&
      auctionHoursLeft < 24;

    const locationLine = formatLocationWithState(listing.suburb, listing.postcode);
    const bedsBathsLine = `${listing.bedrooms} bed · ${listing.bathrooms} bath`;

    const jobCents = listing.current_lowest_bid_cents ?? 0;
    const feeCents = Math.round((jobCents * feePercentage) / 100);
    const totalCents = jobCents + feeCents;

    let mobilePriceLabel = "";
    let mobilePriceDisplay = "";
    let mobileStatusPill = "";
    let mobileStatusPillClass = "";

    if (isJobCard || isCancelledListing) {
      if (jobStatus === "completed") {
        mobilePriceLabel = "Total you paid (job + fee)";
        mobilePriceDisplay = formatCents(totalCents);
      } else if (isDisputedListing) {
        mobilePriceLabel = "Job amount";
        mobilePriceDisplay = formatCents(jobCents);
      } else if (isCancelledListing) {
        mobilePriceLabel = "Listing";
        mobilePriceDisplay = formatCents(jobCents);
      } else {
        mobilePriceLabel = "Total you pay (job + fee)";
        mobilePriceDisplay = formatCents(totalCents);
      }
      mobileStatusPill =
        isJobCard && progressCount > 0 && !isCancelledListing
          ? `${statusLabel} ${progressCount}/5`
          : statusLabel;
      if (isCancelledListing) {
        mobileStatusPillClass =
          "border-red-400/80 bg-red-500/15 text-red-900 dark:border-red-600/50 dark:bg-red-950/60 dark:text-red-100";
      } else if (isDisputedListing) {
        mobileStatusPillClass =
          "border-amber-400/80 bg-amber-500/20 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/50 dark:text-amber-100";
      } else if (jobStatus === "completed") {
        mobileStatusPillClass =
          "border-emerald-300/80 bg-emerald-500/15 text-emerald-900 dark:border-emerald-600/50 dark:bg-emerald-950/60 dark:text-emerald-100";
      } else if (jobStatus === "in_progress") {
        mobileStatusPillClass =
          "border-amber-400/80 bg-amber-500/20 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/50 dark:text-amber-100";
      } else if (jobStatus === "accepted") {
        mobileStatusPillClass =
          "border-sky-400/80 bg-sky-500/15 text-sky-900 dark:border-sky-600/50 dark:bg-sky-950/60 dark:text-sky-100";
      } else {
        mobileStatusPillClass =
          "border-emerald-300/80 bg-emerald-500/15 text-emerald-900 dark:border-emerald-600/50 dark:bg-emerald-950/60 dark:text-emerald-100";
      }
    } else if (isLive) {
      mobilePriceLabel = "Current lowest bid";
      mobilePriceDisplay = formatCents(listing.current_lowest_bid_cents);
      const endingSoon = auctionHoursLeft > 0 && auctionHoursLeft < 24;
      mobileStatusPill = endingSoon
        ? `Ending Soon · ${formatAuctionTimeLeftShort(endTsMs)}`
        : `Live · ${formatAuctionTimeLeftShort(endTsMs)}`;
      mobileStatusPillClass = endingSoon
        ? "border-amber-400/80 bg-amber-500/20 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/50 dark:text-amber-100"
        : "border-emerald-300/80 bg-emerald-500/15 text-emerald-900 dark:border-emerald-600/50 dark:bg-emerald-950/60 dark:text-emerald-100";
    } else if (kind === "ended") {
      mobilePriceLabel = isEndedNoBids ? "Auction ended" : "Final bid";
      mobilePriceDisplay = formatCents(listing.current_lowest_bid_cents);
      if (isEndedNoBids) {
        mobileStatusPill = "Ended · no bids";
        mobileStatusPillClass =
          "border-red-400/80 bg-red-500/15 text-red-900 dark:border-red-600/50 dark:bg-red-950/60 dark:text-red-100";
      } else if (
        jobStatus === "cancelled" ||
        cancelledListingIds.has(listing.id as unknown as string | number)
      ) {
        mobileStatusPill = "Cancelled";
        mobileStatusPillClass =
          "border-red-400/80 bg-red-500/15 text-red-900 dark:border-red-600/50 dark:bg-red-950/60 dark:text-red-100";
      } else {
        mobileStatusPill = "Ended";
        mobileStatusPillClass =
          "border-border bg-muted text-muted-foreground dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300";
      }
    } else {
      mobilePriceLabel = "Amount";
      mobilePriceDisplay = formatCents(listing.current_lowest_bid_cents);
      mobileStatusPill = statusLabel;
      mobileStatusPillClass =
        "border-border bg-muted text-muted-foreground dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300";
    }

    const primaryLabel =
      kind === "ended"
        ? "View listing history"
        : isActiveJob
          ? "Open job"
          : kind === "completed"
            ? "View Job History"
            : isLive
              ? "View Job Bids"
              : "View & bids";

    const primaryHref = `/jobs/${listing.id}`;
    const showMobileSecondaryMessages =
      !!jobInfo &&
      (isJobCard || isCancelledListing) &&
      !!jobInfo.winnerId &&
      jobStatus !== "cancelled" &&
      (jobStatus === "in_progress" ||
        jobStatus === "completed" ||
        isDisputedListing);

    return (
      <div key={listing.id} className="h-full">
        <div className="md:hidden">
          <MyListingsCardMobile
            listingId={listing.id}
            title={listing.title}
            coverUrl={coverUrl}
            listerVerificationBadges={listerVerificationBadges}
            showHot={showHotMobile}
            showCountdown={false}
            endTime={listing.end_time}
            statusPill={mobileStatusPill}
            statusPillClassName={mobileStatusPillClass}
            priceLabel={mobilePriceLabel}
            priceDisplay={mobilePriceDisplay}
            locationLine={locationLine}
            bedsBathsLine={bedsBathsLine}
            cardClassName={cardClass}
            primaryHref={primaryHref}
            primaryLabel={primaryLabel}
            secondaryHref={
              showMobileSecondaryMessages && jobInfo
                ? `/messages?job=${jobInfo.jobId}`
                : undefined
            }
            secondaryLabel={showMobileSecondaryMessages ? "Messages" : undefined}
            showCancel={!isActiveJob && isLive && !isCancelledListing}
            onCancel={
              !isActiveJob && isLive && !isCancelledListing
                ? () => {
                    void (async () => {
                      const confirmed = window.confirm(
                        "Are you sure you want to cancel this listing? This will stop new bids but keep the listing in your history."
                      );
                      if (!confirmed) return;
                      const res = await cancelListing(listing.id);
                      if (!res.ok) {
                        alert(res.error);
                      }
                    })();
                  }
                : undefined
            }
          >
            <>
              {(isJobCard || isCancelledListing) && (
                <div className="space-y-2">
                  {isCancelledListing && (
                    <p className="text-sm font-medium text-red-900 dark:text-red-200">
                      Cancelled
                      {cancelledDateLabel ? ` (${cancelledDateLabel})` : ""}
                    </p>
                  )}
                  {isDisputedListing && (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Dispute in progress — open the job to respond.
                    </p>
                  )}
                  {jobStatus === "completed" && (
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">
                      {completedDateLabel
                        ? `Completed ${completedDateLabel}`
                        : "Completed"}
                    </p>
                  )}
                  {isJobCard &&
                    !isCancelledListing &&
                    !isDisputedListing &&
                    jobStatus !== "completed" && (
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        Job {formatCents(jobCents)} + {feePercentage}% fee ={" "}
                        {formatCents(totalCents)} total
                      </p>
                    )}
                </div>
              )}
              {jobInfo && (isJobCard || isCancelledListing) && (
                <div className="flex min-h-0 flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm dark:border-gray-800">
                  <span className="font-medium text-muted-foreground dark:text-gray-400">
                    Assigned
                  </span>
                  <div className="flex min-w-0 items-center justify-end gap-2">
                    {isCancelledListing ? (
                      <span className="font-medium text-muted-foreground dark:text-gray-400">
                        Un-assigned
                      </span>
                    ) : jobStatus === "in_progress" ||
                      jobStatus === "completed" ||
                      isDisputedListing ? (
                      <>
                        {jobInfo.winnerId ? (
                          <Link
                            href={`/cleaners/${jobInfo.winnerId}`}
                            className="truncate font-semibold text-sky-800 hover:underline dark:text-sky-300"
                          >
                            {jobInfo.winnerName}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground dark:text-gray-200">{jobInfo.winnerName}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-right text-muted-foreground dark:text-gray-400">
                        Approve job to see cleaner
                      </span>
                    )}
                  </div>
                </div>
              )}
              {!isJobCard && isLive && (
                <p className="text-sm text-muted-foreground dark:text-gray-400">
                  Starting {formatCents(listing.starting_price_cents)} ·{" "}
                  {bidIdSet.has(listing.id as unknown as string | number)
                    ? "1+"
                    : "0"}{" "}
                  bids
                </p>
              )}
            </>
          </MyListingsCardMobile>
        </div>
        <Card
          className={cn(
            "hidden h-full flex-col md:flex",
            cardClass,
            kind === "completed" ? "text-xs sm:text-[11px]" : ""
          )}
        >
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isLive && !isCancelledListing && (
              <CountdownTimer
                endTime={listing.end_time}
                className="text-xs text-muted-foreground"
                expiredLabel="Ended"
              />
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-tight">
            {listing.title}
          </p>
        </CardHeader>
        <CardContent className="flex-1 space-y-2 text-sm">
          <Link
            href={`/jobs/${listing.id}`}
            className="group/thumb mb-1 block w-full overflow-hidden rounded-xl border border-border bg-muted/40 transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800"
            aria-label={`View more photos/info: ${listing.title}`}
          >
            <div className="relative h-36 w-full">
              <OptimizedImage
                src={getListingCoverUrl(listing) ?? "/placeholder-listing.png"}
                alt="Property"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="h-full w-full rounded-xl transition-transform duration-200 group-hover/thumb:scale-[1.02]"
              />
              {/* Faded overlay + "View more photos/info" — hover (desktop) / subtle on touch */}
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition-colors duration-200 [@media(hover:hover)]:group-hover/thumb:bg-black/50 [@media(hover:none)]:bg-black/30">
                <span className="text-center text-sm font-medium text-white opacity-0 drop-shadow-md transition-opacity duration-200 [@media(hover:hover)]:group-hover/thumb:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:text-xs [@media(hover:none)]:px-2">
                  View more photos/info
                </span>
              </div>
            </div>
          </Link>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground dark:text-gray-400">
              {isJobCard ? "Job progress" : "Status"}
            </span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={statusClass}>
                    {isJobCard && progressCount > 0
                      ? `${statusLabel} ${progressCount}/5`
                      : statusLabel}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  <p>
                    {jobStatus === "accepted" &&
                      "Active – job created, waiting for owner approval."}
                    {jobStatus === "in_progress" &&
                      (cleanerConfirmed
                        ? "In progress – cleaner has marked the checklist complete and uploaded photos."
                        : "In progress – work underway, checklist not yet confirmed.")}
                    {jobStatus === "completed" &&
                      "Task has been completed – funds released and job fully finished."}
                  {jobStatus === "cancelled" &&
                      "Cancelled – this job was cancelled by the property lister. The cleaner was un-assigned."}
                    {!isJobCard &&
                      listing.status === "live" &&
                      "Live – accepting bids until the auction end time."}
                    {!isJobCard &&
                      listing.status === "ended" &&
                      "Ended – this auction has finished and is now in your history."}
                    {!isJobCard &&
                      listing.status !== "live" &&
                      listing.status !== "ended" &&
                      "Status of this listing."}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground dark:text-gray-400">
            <span>
              {listing.bedrooms} bed · {listing.bathrooms} bath
            </span>
            <span>
              {listing.suburb} {listing.postcode}
            </span>
          </div>

          {(isJobCard || isCancelledListing) && (
            <div
              className={`space-y-1 rounded-md border px-3 py-2 ${
                isCancelledListing
                  ? "border-red-300 bg-red-50/80 dark:border-red-700 dark:bg-red-900/50"
                  : isDisputedListing
                    ? "border-amber-300 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-900/50"
                    : jobStatus === "completed"
                      ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-600 dark:bg-emerald-900/40"
                      : "border-emerald-300 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-900/40"
              }`}
            >
              {isCancelledListing ? (
                <>
                  <p className="text-xs font-medium text-red-900 dark:text-red-200">
                    Cancelled by Property Lister
                  </p>
                  <p className="text-[11px] text-red-800 dark:text-red-200">
                    This listing was cancelled by the property lister
                    {cancelledDateLabel ? (
                      <>
                        {" "}
                        on <span className="font-medium">{cancelledDateLabel}</span>
                      </>
                    ) : null}
                    . Cleaner un-assigned.
                  </p>
                </>
              ) : isDisputedListing ? (
                <>
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                    Dispute in progress
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-200">
                    This job is under dispute. Respond in the job to resolve.
                  </p>
                  <p className="text-2xl font-semibold text-amber-700 dark:text-amber-200">
                    {formatCents(listing.current_lowest_bid_cents)}
                  </p>
                </>
              ) : jobStatus === "completed" ? (
                <>
                  <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                    Task has been completed
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                    Payment released:{" "}
                    <span className="font-semibold">
                      {formatCents(listing.current_lowest_bid_cents)}
                    </span>
                    {completedDateLabel && (
                      <>
                        {" "}
                        · Completed on{" "}
                        <span className="font-medium">
                          {completedDateLabel}
                        </span>
                      </>
                    )}
                  </p>
                  {(() => {
                    const jobCents = listing.current_lowest_bid_cents ?? 0;
                    const feeCents = Math.round((jobCents * feePercentage) / 100);
                    const totalCents = jobCents + feeCents;
                    return (
                      <div className="mt-2 space-y-1.5 rounded-md border border-emerald-200/80 bg-white/60 px-2 py-2 text-[11px] leading-snug dark:border-emerald-800/50 dark:bg-emerald-950/30 sm:text-xs">
                        <p className="font-medium text-emerald-900 dark:text-emerald-100">
                          Job amount to be paid to cleaner
                        </p>
                        <p className="tabular-nums font-semibold text-emerald-800 dark:text-emerald-200">
                          {formatCents(jobCents)}
                        </p>
                        <p className="text-emerald-800/90 dark:text-emerald-300/90">
                          (excl. {feePercentage}% platform fee:{" "}
                          <span className="font-medium tabular-nums">
                            {formatCents(feeCents)}
                          </span>
                          )
                        </p>
                        <p className="border-t border-emerald-200/70 pt-1.5 text-emerald-900 dark:text-emerald-100">
                          <span className="font-medium">Total you paid (job + fee):</span>{" "}
                          <span className="font-semibold tabular-nums">
                            {formatCents(totalCents)}
                          </span>
                        </p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
                    Won for
                  </p>
                  {(() => {
                    const jobCents = listing.current_lowest_bid_cents ?? 0;
                    const feeCents = Math.round((jobCents * feePercentage) / 100);
                    const totalCents = jobCents + feeCents;
                    return (
                      <div className="space-y-2">
                        <p className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-200">
                          {formatCents(jobCents)}
                        </p>
                        <div className="space-y-1.5 rounded-md border border-emerald-200/80 bg-white/60 px-2 py-2 text-[11px] leading-snug dark:border-emerald-800/50 dark:bg-emerald-950/30 sm:text-xs">
                          <p className="font-medium text-emerald-900 dark:text-emerald-100">
                            Job amount to be paid to cleaner
                          </p>
                          <p className="tabular-nums font-semibold text-emerald-800 dark:text-emerald-200">
                            {formatCents(jobCents)}
                          </p>
                          <p className="text-emerald-800/90 dark:text-emerald-300/90">
                            (excl. {feePercentage}% platform fee:{" "}
                            <span className="font-medium tabular-nums">
                              {formatCents(feeCents)}
                            </span>
                            )
                          </p>
                          <p className="border-t border-emerald-200/70 pt-1.5 text-emerald-900 dark:text-emerald-100">
                            <span className="font-medium">Total you pay (job + fee):</span>{" "}
                            <span className="font-semibold tabular-nums">
                              {formatCents(totalCents)}
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {(isJobCard || isCancelledListing) && jobInfo && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Assigned to</span>
              <div className="flex items-center gap-2">
                {isCancelledListing ? (
                  <span className="text-sm font-medium text-muted-foreground dark:text-gray-400">
                    Un-assigned
                  </span>
                ) : jobStatus === "in_progress" || jobStatus === "completed" || isDisputedListing ? (
                  <>
                    {jobInfo.winnerId ? (
                      <Link
                        href={`/cleaners/${jobInfo.winnerId}`}
                        className="text-sm font-medium text-sky-800 hover:underline"
                      >
                        {jobInfo.winnerName}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">
                        {jobInfo.winnerName}
                      </span>
                    )}
                    <Link
                      href="/messages"
                      className="text-sky-700 hover:text-sky-900"
                      title="Open messages"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Link>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Approve job to start to view cleaner and chat
                  </span>
                )}
              </div>
            </div>
          )}
          {!isJobCard && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current lowest</span>
              <span className="font-semibold text-accent">
                {formatCents(listing.current_lowest_bid_cents)}
              </span>
            </div>
          )}

          {kind === "live" && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Starting price</span>
                <span>{formatCents(listing.starting_price_cents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Number of bids</span>
                <span>
                  {bidIdSet.has(listing.id as unknown as string | number)
                    ? "1+"
                    : "0"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span>
                  {listing.suburb} {listing.postcode}
                </span>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 pt-2">
          {kind === "ended" ? (
            <Button asChild variant="outline" className="flex-1" size="sm">
              <Link href={`/jobs/${listing.id}`}>View listing history</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" className="flex-1" size="sm">
                <Link href={`/jobs/${listing.id}`}>
                  {isActiveJob
                    ? "Open job"
                    : kind === "completed"
                      ? "View Job History"
                      : isLive
                        ? "View Job Bids"
                        : "View & bids"}
                </Link>
              </Button>
              {!isActiveJob && isLive && !isCancelledListing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 w-full border-amber-300 text-[11px] text-amber-800 hover:bg-amber-50"
                  onClick={async () => {
                    const confirmed = window.confirm(
                      "Are you sure you want to cancel this listing? This will stop new bids but keep the listing in your history."
                    );
                    if (!confirmed) return;
                    const res = await cancelListing(listing.id);
                    if (!res.ok) {
                      alert(res.error);
                    }
                  }}
                >
                  Cancel listing
                </Button>
              )}
            </>
          )}
        </CardFooter>
      </Card>
      </div>
    );
  };

  return (
    <>
      {listings.length === 0 ? (
        <Card className="mx-auto max-w-xl border-dashed bg-card/80 text-center shadow-md">
          <CardHeader className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/40">
              <ImagePlus className="h-6 w-6 text-emerald-600 dark:text-emerald-200" />
            </div>
            <CardTitle className="text-lg dark:text-gray-100">
              Start listing your bond cleans today!
            </CardTitle>
            <CardDescription>
              Create your first listing in a few quick steps and let cleaners bid to help you get your bond back.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild size="sm" className="rounded-full px-6 text-sm font-semibold">
              <Link href="/listings/new">Create your first bond clean listing</Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              You can manage all your future listings and jobs from this dashboard.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewTab === "active_listings" && liveListingsWithBids.length > 0 && (
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                <Gavel className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                Live Listing Auctions
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {liveListingsWithBids.map((listing) => renderCard(listing, "live"))}
              </div>
            </div>
          )}
          {viewTab === "active_listings" && activeNonCompletedListings.length > 0 && (
            <div className={liveListingsWithBids.length > 0 ? "mt-6 space-y-2" : "space-y-2"}>
              <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                Active jobs (purchased / won)
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeNonCompletedListings.map((listing) =>
                  renderCard(listing, "active")
                )}
              </div>
            </div>
          )}
          {viewTab === "active_listings" && noBidLiveListings.length > 0 && (
            <div className="mt-6 space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                New listings (no bids yet)
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {noBidLiveListings.map((listing) => renderCard(listing, "live"))}
              </div>
            </div>
          )}
          {viewTab === "active_listings" && endedListings.length > 0 && (
            <div className="mt-6 space-y-2">
              <details className="space-y-2">
                <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
                  Ended/Cancelled listings (history)
                </summary>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {endedListings.map((listing) =>
                    renderCard(listing, "ended")
                  )}
                </div>
              </details>
            </div>
          )}
          {viewTab === "completed_jobs" && (
            <div className="space-y-2">
              {completedListings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center dark:bg-gray-800/30">
                  <p className="text-sm font-medium text-foreground dark:text-gray-100">
                    No completed jobs yet.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {completedListings.map((listing) =>
                    renderCard(listing, "completed")
                  )}
                </div>
              )}
            </div>
          )}
          {viewTab === "pending_payments" && (
            <div className="space-y-2">
              {pendingPaymentsListings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center dark:bg-gray-800/30">
                  <p className="text-sm font-medium text-foreground dark:text-gray-100">
                    No pending payments.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingPaymentsListings.map((listing) =>
                    renderCard(listing, "active")
                  )}
                </div>
              )}
            </div>
          )}
          {viewTab === "disputes" && (
            <div className="space-y-2">
              {disputedListings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center dark:bg-gray-800/30">
                  <p className="text-sm font-medium text-foreground dark:text-gray-100">
                    No disputes.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {disputedListings.map((listing) =>
                    renderCard(listing, "active")
                  )}
                </div>
              )}
            </div>
          )}
          {viewTab === "cancelled_listings" && (
            <div className="space-y-2">
              {cancelledListings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center dark:bg-gray-800/30">
                  <p className="text-sm font-medium text-foreground dark:text-gray-100">
                    No cancelled listings yet.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cancelledListings.map((listing) => renderCard(listing, "ended"))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg bg-background p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ImagePlus className="h-4 w-4 text-emerald-600" />
                  Edit / Upload property photos
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Update the photos for this listing to help cleaners understand the job.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeEditor}
              >
                Close
              </Button>
            </div>
              <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">
                  Property photos ({editPhotoUrls.length}/{PHOTO_LIMITS.LISTING_EDIT})
                </Label>
                <div className="flex flex-wrap gap-2">
                  {editPhotoUrls.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className={`relative h-20 w-20 overflow-hidden rounded-md border bg-background text-[10px] ${
                        index === 0
                          ? "ring-2 ring-emerald-500"
                          : "hover:ring-2 hover:ring-muted-foreground/40"
                      }`}
                      onClick={async () => {
                        if (!editing) return;
                        if (index === 0) return;
                        const next = [...editPhotoUrls];
                        next.splice(index, 1);
                        next.unshift(url);
                        setEditPhotoUrls(next);
                        const result = await updateListingDetails(editing.id, {
                          description: editDescription.trim() || null,
                          photo_urls: next.length ? next : null,
                        });
                        if (!result.ok) {
                          setEditError(result.error);
                        } else {
                          setListings((prev) =>
                            prev.map((l) =>
                              l.id === editing.id
                                ? ({
                                    ...l,
                                    description:
                                      editDescription.trim() || null,
                                    photo_urls: next.length ? next : null,
                                  } as ListingRow)
                                : l
                            )
                          );
                        }
                      }}
                    >
                      <OptimizedImage
                        src={url}
                        alt="Listing"
                        width={80}
                        height={80}
                        className="h-20 w-20 rounded-md object-cover"
                      />
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!editing) return;
                          const next = editPhotoUrls.filter((u) => u !== url);
                          setEditPhotoUrls(next);
                          const result = await updateListingDetails(editing.id, {
                            description: editDescription.trim() || null,
                            photo_urls: next.length ? next : null,
                          });
                          if (!result.ok) {
                            setEditError(result.error);
                          } else {
                            setListings((prev) =>
                              prev.map((l) =>
                                l.id === editing.id
                                  ? ({
                                      ...l,
                                      description:
                                        editDescription.trim() || null,
                                      photo_urls: next.length ? next : null,
                                    } as ListingRow)
                                  : l
                              )
                            );
                          }
                        }}
                        className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground shadow"
                      >
                        ✕
                      </button>
                      {index === 0 ? (
                        <span className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 px-1 py-0.5 text-[10px] font-medium text-emerald-50">
                          Default
                        </span>
                      ) : (
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white">
                          Set as default
                        </span>
                      )}
                    </div>
                  ))}
                  <label className={cn(
                      "flex h-20 w-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-muted-foreground/50 bg-muted/40 text-[11px] text-muted-foreground hover:bg-muted/70 dark:bg-gray-800 dark:border-gray-600",
                      editPhotoUrls.length >= PHOTO_LIMITS.LISTING_EDIT && "pointer-events-none opacity-60"
                    )}>
                    <Input
                      type="file"
                      accept={PHOTO_VALIDATION.ACCEPT}
                      multiple
                      className="hidden"
                      onChange={handleListingPhotosChange}
                      disabled={uploadingPhotos || editPhotoUrls.length >= PHOTO_LIMITS.LISTING_EDIT}
                    />
                    {uploadingPhotos ? (
                      "Uploading…"
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <ImagePlus className="h-4 w-4" />
                        <span>Add photos</span>
                      </div>
                    )}
                  </label>
                </div>
                {editError && (
                  <p className="text-xs text-destructive">{editError}</p>
                )}
              </div>

              {editError && (
                <p className="text-xs text-destructive">{editError}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={closeEditor}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 animate-in fade-in-0"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="max-h-[90vh] max-w-3xl overflow-hidden rounded-lg bg-background shadow-xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Listing photo"
              className="h-full w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      )}
    </>
  );
}
