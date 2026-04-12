"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImagePlus, Search, ClipboardList, Inbox, FileEdit, Scale } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { formatCents, getListingCoverUrl } from "@/lib/listings";
import { parseUtcTimestamp } from "@/lib/utils";
import type { ListingRow } from "@/lib/listings";
import {
  cancelListing,
  relistExpiredListing,
  updateListingDetails,
} from "@/lib/actions/listings";
import { useToast } from "@/components/ui/use-toast";
import {
  validatePhotoFiles,
  PHOTO_LIMITS,
  PHOTO_VALIDATION,
  checkImageHeader,
} from "@/lib/photo-validation";
import { uploadProcessedPhotos } from "@/lib/actions/upload-photos";
import { cn } from "@/lib/utils";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListerListingCard } from "@/components/my-listings/lister-listing-card";
import { ListerDisputedCard } from "@/components/my-listings/lister-disputed-card";
import { PullToRefresh } from "@/components/my-listings/pull-to-refresh";
import {
  classifyListerBadge,
  buildTimeLabel,
  isListerAuctionLiveBidding,
  passesListFilter,
  listingMatchesCompletedTab,
  isDisputedJobStatus,
  type ListFilter,
} from "@/lib/my-listings/lister-listing-helpers";
import {
  loadListingDraftLocal,
  clearListingDraftLocal,
} from "@/lib/listing-draft-storage";
import { hrefListingOrJob } from "@/lib/navigation/listing-or-job-href";

function preferJobRow<
  T extends { status: string | null; updated_at?: string | null },
>(a: T, b: T): T {
  const ac = a.status === "cancelled";
  const bc = b.status === "cancelled";
  if (ac && !bc) return b;
  if (!ac && bc) return a;
  const ta = a.updated_at ? Date.parse(String(a.updated_at)) : 0;
  const tb = b.updated_at ? Date.parse(String(b.updated_at)) : 0;
  return tb >= ta ? b : a;
}

export type ListerViewTab = "active" | "disputed" | "completed" | "drafts" | "all";

type JobRowState = {
  jobId: number | string;
  winnerId: string | null;
  winnerName: string;
  status: string | null;
  cleanerConfirmedComplete?: boolean | null;
  cleanerConfirmedAt?: string | null;
  updatedAt?: string | null;
  disputed_at?: string | null;
  dispute_reason?: string | null;
  dispute_status?: string | null;
  dispute_opened_by?: string | null;
  agreed_amount_cents?: number | null;
};

export type MyListingsListProps = {
  initialListings: ListingRow[];
  listerId: string;
  initialEditListingId?: string | null;
  initialOpenCancelListingId?: string | null;
  viewTab: ListerViewTab;
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
      disputed_at?: string | null;
      dispute_reason?: string | null;
      dispute_status?: string | null;
      dispute_opened_by?: string | null;
      agreed_amount_cents?: number | null;
    }
  >;
  tabCounts: {
    active: number;
    disputed: number;
    completed: number;
    all: number;
  };
};

export function MyListingsList({
  initialListings,
  listerId,
  initialEditListingId = null,
  initialOpenCancelListingId = null,
  viewTab,
  initialActiveJobsSnapshot,
  tabCounts,
}: MyListingsListProps) {
  const [listings, setListings] = useState<ListingRow[]>(initialListings);
  const [activeJobs, setActiveJobs] = useState<Record<string, JobRowState>>(() => {
    const snap = initialActiveJobsSnapshot;
    if (!snap) return {};
    const out: Record<string, JobRowState> = {};
    for (const l of initialListings) {
      const row = snap[String(l.id)];
      if (row) {
        out[String(l.id)] = row;
      }
    }
    return out;
  });
  const [bidCounts, setBidCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [localDraft, setLocalDraft] = useState<ReturnType<
    typeof loadListingDraftLocal
  > | null>(null);

  const [editing, setEditing] = useState<ListingRow | null>(null);
  const [editPhotoUrls, setEditPhotoUrls] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cancelListingTarget, setCancelListingTarget] = useState<ListingRow | null>(null);
  const [cancellingListing, setCancellingListing] = useState(false);
  const [relistingId, setRelistingId] = useState<string | null>(null);
  const openedForEditIdRef = useRef<string | null>(null);
  const cancelParamHandledRef = useRef(false);

  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    setLocalDraft(loadListingDraftLocal());
  }, [viewTab, listings.length]);

  const listingsDeduped = useMemo(() => {
    const seen = new Map<string, ListingRow>();
    for (const l of listings) {
      const k = String(l.id);
      if (!seen.has(k)) seen.set(k, l);
    }
    return Array.from(seen.values());
  }, [listings]);

  useEffect(() => {
    const channel = supabase
      .channel("my-listings-v2")
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
            const row = payload.new as ListingRow;
            setListings((prev) => {
              if (prev.some((l) => String(l.id) === String(row.id))) return prev;
              return [row, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as ListingRow;
            setListings((prev) => prev.map((l) => (l.id === row.id ? row : l)));
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

  useEffect(() => {
    if (!listingsDeduped.length) return;
    const ids = listingsDeduped.map((l) => l.id as unknown as string | number);
    const loadJobs = async () => {
      const { data } = await supabase
        .from("jobs")
        .select(
          "id, listing_id, winner_id, status, cleaner_confirmed_complete, cleaner_confirmed_at, updated_at, disputed_at, dispute_reason, dispute_status, dispute_opened_by, agreed_amount_cents"
        )
        .in("listing_id", ids as never);
      const jobs = (data ?? []) as {
        id: number | string;
        listing_id: string | number;
        winner_id: string | null;
        status: string | null;
        cleaner_confirmed_complete?: boolean | null;
        cleaner_confirmed_at?: string | null;
        updated_at?: string | null;
        disputed_at?: string | null;
        dispute_reason?: string | null;
        dispute_status?: string | null;
        dispute_opened_by?: string | null;
        agreed_amount_cents?: number | null;
      }[];

      const jobsByListing = new Map<string, (typeof jobs)[number][]>();
      for (const j of jobs) {
        const lid = String(j.listing_id);
        const arr = jobsByListing.get(lid) ?? [];
        arr.push(j);
        jobsByListing.set(lid, arr);
      }

      const winnerIds = Array.from(
        new Set(jobs.map((j) => j.winner_id).filter((id): id is string => !!id))
      );

      let winnerNames: Record<string, string> = {};
      if (winnerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", winnerIds as never);
        winnerNames = Object.fromEntries(
          (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
            p.id,
            p.full_name?.trim() || "Cleaner",
          ])
        );
      }

      const jobMap: Record<string, JobRowState> = {};
      for (const [lid, arr] of jobsByListing) {
        const j = arr.reduce((best, cur) => preferJobRow(best, cur));
        jobMap[lid] = {
          jobId: j.id,
          winnerId: j.winner_id,
          winnerName: j.winner_id ? winnerNames[j.winner_id] || "Cleaner" : "Cleaner",
          status: j.status,
          cleanerConfirmedComplete: j.cleaner_confirmed_complete ?? null,
          cleanerConfirmedAt: j.cleaner_confirmed_at ?? null,
          updatedAt: j.updated_at ?? null,
          disputed_at: j.disputed_at ?? null,
          dispute_reason: j.dispute_reason ?? null,
          dispute_status: j.dispute_status ?? null,
          dispute_opened_by: j.dispute_opened_by ?? null,
          agreed_amount_cents: j.agreed_amount_cents ?? null,
        };
      }
      setActiveJobs(jobMap);
    };
    loadJobs();
  }, [supabase, listingsDeduped]);

  useEffect(() => {
    if (!listingsDeduped.length) return;
    const ids = listingsDeduped.map((l) => l.id as unknown as string | number);
    const loadBids = async () => {
      const { data } = await supabase
        .from("bids")
        .select("listing_id")
        .in("listing_id", ids as never);
      const counts: Record<string, number> = {};
      for (const b of data ?? []) {
        const row = b as { listing_id: string | number };
        const k = String(row.listing_id);
        counts[k] = (counts[k] ?? 0) + 1;
      }
      setBidCounts(counts);
    };
    loadBids();
  }, [supabase, listingsDeduped]);

  const openEditor = (listing: ListingRow) => {
    setEditing(listing);
    setEditPhotoUrls(
      Array.isArray(listing.photo_urls) ? (listing.photo_urls as string[]) : []
    );
    setEditDescription(listing.description ?? "");
    setEditError(null);
  };

  useEffect(() => {
    if (!initialEditListingId || listingsDeduped.length === 0) return;
    if (openedForEditIdRef.current === initialEditListingId) return;
    const listing = listingsDeduped.find(
      (l) => String(l.id) === String(initialEditListingId)
    );
    if (listing) {
      openedForEditIdRef.current = initialEditListingId;
      openEditor(listing);
    }
  }, [initialEditListingId, listingsDeduped]);

  const closeEditor = () => {
    setEditing(null);
    setEditPhotoUrls([]);
    setEditDescription("");
    setEditError(null);
    setUploadingPhotos(false);
    setIsSaving(false);
  };

  const openCancelListingConfirm = (listing: ListingRow) => {
    setCancelListingTarget(listing);
  };

  const handleConfirmCancelListing = async () => {
    if (!cancelListingTarget) return;
    setCancellingListing(true);
    try {
      const res = await cancelListing(String(cancelListingTarget.id));
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not cancel listing",
          description: res.error,
        });
        return;
      }
      const id = cancelListingTarget.id;
      setListings((prev) =>
        prev.map((l) =>
          l.id === id ? ({ ...l, status: "ended" } as ListingRow) : l
        )
      );
      setCancelListingTarget(null);
      toast({
        title: "Listing cancelled",
        description: "The auction has ended early. You can find it under All.",
      });
      router.refresh();
    } finally {
      setCancellingListing(false);
    }
  };

  useEffect(() => {
    if (!initialOpenCancelListingId) {
      cancelParamHandledRef.current = false;
      return;
    }
    if (cancelParamHandledRef.current) return;
    const targetId = String(initialOpenCancelListingId);
    const listing = listingsDeduped.find((l) => String(l.id) === targetId);
    const stripCancelParam = () => {
      const params = new URLSearchParams(searchParams.toString());
      if (!params.has("cancel")) return;
      params.delete("cancel");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };
    if (!listing) {
      cancelParamHandledRef.current = true;
      stripCancelParam();
      return;
    }
    const stillLive =
      listing.status === "live" && parseUtcTimestamp(listing.end_time) > Date.now();
    cancelParamHandledRef.current = true;
    if (stillLive) {
      setCancelListingTarget(listing);
    }
    stripCancelParam();
  }, [initialOpenCancelListingId, listingsDeduped, pathname, router, searchParams]);

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
      toast({ variant: "destructive", title: "Photo validation", description: err });
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

  const handleRelist = async (listingId: string) => {
    setRelistingId(listingId);
    const result = await relistExpiredListing(listingId);
    setRelistingId(null);
    if (!result.ok) {
      toast({
        variant: "destructive",
        title: "Could not relist",
        description: result.error,
      });
      return;
    }
    toast({
      title: "Listing relisted",
      description: "Your auction is live again with the same settings and duration.",
    });
    router.refresh();
  };

  const activeIdSet = useMemo(() => {
    const s = new Set<string>();
    for (const [lid, info] of Object.entries(activeJobs)) {
      if (info?.status != null && info.status !== "cancelled") {
        s.add(String(lid));
      }
    }
    return s;
  }, [activeJobs]);

  const bidIdSet = useMemo(
    () => new Set(Object.keys(bidCounts).filter((k) => (bidCounts[k] ?? 0) > 0)),
    [bidCounts]
  );

  const activeListings = listingsDeduped.filter((l) => activeIdSet.has(String(l.id)));
  const completedListings = activeListings.filter((l) => {
    const info = activeJobs[String(l.id)] ?? null;
    return info && info.status === "completed";
  });
  const activeNonCompletedListings = activeListings.filter((l) => {
    const info = activeJobs[String(l.id)] ?? null;
    return !info || info.status !== "completed";
  });

  const otherListings = listingsDeduped.filter((l) => !activeIdSet.has(String(l.id)));
  const nowMs = Date.now();
  const cancelledJobListingIds = new Set<string>(
    listingsDeduped
      .filter((l) => activeJobs[String(l.id)]?.status === "cancelled")
      .map((l) => String(l.id))
  );
  const liveListings = otherListings.filter(
    (l) =>
      l.status === "live" &&
      parseUtcTimestamp(l.end_time) > nowMs &&
      !cancelledJobListingIds.has(String(l.id))
  );
  const noBidLiveListings = liveListings.filter((l) => !bidIdSet.has(String(l.id)));
  const liveListingsWithBids = liveListings.filter((l) => bidIdSet.has(String(l.id)));

  const activeTabListings = useMemo(() => {
    const map = new Map<string, ListingRow>();
    for (const l of activeNonCompletedListings) {
      if (isDisputedJobStatus(activeJobs[String(l.id)]?.status)) continue;
      map.set(String(l.id), l);
    }
    for (const l of liveListingsWithBids) map.set(String(l.id), l);
    for (const l of noBidLiveListings) map.set(String(l.id), l);
    const arr = Array.from(map.values());
    arr.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return arr;
  }, [activeNonCompletedListings, liveListingsWithBids, noBidLiveListings, activeJobs]);

  const disputedTabListings = useMemo(() => {
    const arr = listingsDeduped.filter((l) =>
      isDisputedJobStatus(activeJobs[String(l.id)]?.status)
    );
    arr.sort((a, b) => {
      const ja = activeJobs[String(a.id)]?.disputed_at ?? activeJobs[String(a.id)]?.updatedAt;
      const jb = activeJobs[String(b.id)]?.disputed_at ?? activeJobs[String(b.id)]?.updatedAt;
      const ta = ja ? Date.parse(String(ja)) : 0;
      const tb = jb ? Date.parse(String(jb)) : 0;
      return tb - ta;
    });
    return arr;
  }, [listingsDeduped, activeJobs]);

  const completedSorted = useMemo(() => {
    const arr = [...completedListings];
    arr.sort((a, b) => {
      const ja = activeJobs[String(a.id)]?.cleanerConfirmedAt ?? activeJobs[String(a.id)]?.updatedAt;
      const jb = activeJobs[String(b.id)]?.cleanerConfirmedAt ?? activeJobs[String(b.id)]?.updatedAt;
      const ta = ja ? Date.parse(String(ja)) : 0;
      const tb = jb ? Date.parse(String(jb)) : 0;
      return tb - ta;
    });
    return arr;
  }, [completedListings, activeJobs]);

  const allSorted = useMemo(() => {
    const arr = [...listingsDeduped];
    arr.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return arr;
  }, [listingsDeduped]);

  const searchLower = search.trim().toLowerCase();
  const matchesSearch = (l: ListingRow) => {
    if (!searchLower) return true;
    const q = searchLower;
    return (
      String(l.title ?? "")
        .toLowerCase()
        .includes(q) ||
      String(l.suburb ?? "")
        .toLowerCase()
        .includes(q) ||
      String(l.postcode ?? "").includes(q)
    );
  };

  const resolveRowsForTab = (): ListingRow[] => {
    switch (viewTab) {
      case "active":
        return activeTabListings.filter((l) => {
          const j = activeJobs[String(l.id)];
          return matchesSearch(l) && passesListFilter(listFilter, l, j, nowMs);
        });
      case "disputed":
        return disputedTabListings.filter((l) => {
          const j = activeJobs[String(l.id)];
          return matchesSearch(l) && passesListFilter(listFilter, l, j, nowMs);
        });
      case "completed":
        return completedSorted.filter((l) => {
          const j = activeJobs[String(l.id)];
          return (
            matchesSearch(l) &&
            listingMatchesCompletedTab(j) &&
            passesListFilter(listFilter, l, j, nowMs)
          );
        });
      case "all":
        return allSorted.filter((l) => {
          const j = activeJobs[String(l.id)];
          return matchesSearch(l) && passesListFilter(listFilter, l, j, nowMs);
        });
      default:
        return [];
    }
  };

  const displayRows = resolveRowsForTab();

  const refresh = useCallback(async () => {
    router.refresh();
  }, [router]);

  const addressLine = (l: ListingRow) => {
    const addr = (l as ListingRow & { property_address?: string | null }).property_address?.trim();
    if (addr) return addr;
    return formatLocationWithState(l.suburb, l.postcode);
  };

  const draftCount = localDraft ? 1 : 0;

  const tabPill = (
    href: string,
    active: boolean,
    children: React.ReactNode,
    tone: "emerald" | "amber" = "emerald"
  ) => (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex min-h-[44px] touch-manipulation snap-center items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
        active
          ? tone === "amber"
            ? "bg-amber-600 text-white shadow-sm ring-1 ring-black/10 dark:bg-amber-600 dark:text-white dark:ring-amber-400/25 [&_span]:text-white/85"
            : "bg-emerald-600 text-white shadow-sm ring-1 ring-black/10 dark:bg-emerald-600 dark:text-white dark:ring-emerald-400/25 [&_span]:text-white/85"
          : "border border-transparent bg-muted/90 text-muted-foreground hover:bg-muted dark:border-gray-700/90 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      )}
    >
      {children}
    </Link>
  );

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-4">
        {viewTab !== "drafts" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, suburb, postcode…"
                className="h-12 rounded-xl border-border/80 pl-10 pr-4 text-base shadow-sm dark:bg-gray-950 md:pl-11 md:pr-3"
                aria-label="Search listings"
              />
            </div>
            <Select
              value={listFilter}
              onValueChange={(v) => setListFilter(v as ListFilter)}
            >
              <SelectTrigger className="h-12 w-full rounded-xl sm:w-[200px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="auctions">Auctions only</SelectItem>
                <SelectItem value="jobs">Jobs only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {tabPill(
            `/my-listings?tab=active`,
            viewTab === "active",
            <>
              Active <span className="ml-1 tabular-nums opacity-60">({tabCounts.active})</span>
            </>
          )}
          {tabPill(
            `/my-listings?tab=disputed`,
            viewTab === "disputed",
            <>
              Disputed{" "}
              <span className="ml-1 tabular-nums opacity-60">({tabCounts.disputed})</span>
            </>,
            "amber"
          )}
          {tabPill(
            `/my-listings?tab=completed`,
            viewTab === "completed",
            <>
              Completed{" "}
              <span className="ml-1 tabular-nums opacity-60">({tabCounts.completed})</span>
            </>
          )}
          {tabPill(
            `/my-listings?tab=drafts`,
            viewTab === "drafts",
            <>
              Drafts <span className="ml-1 tabular-nums opacity-60">({draftCount})</span>
            </>
          )}
          {tabPill(
            `/my-listings?tab=all`,
            viewTab === "all",
            <>
              All <span className="ml-1 tabular-nums opacity-60">({tabCounts.all})</span>
            </>
          )}
        </div>

        <div className="min-h-[40vh] space-y-3">
          {viewTab === "drafts" && (
            <>
              {!localDraft ? (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center dark:border-gray-800 dark:bg-gray-900/40">
                  <FileEdit className="h-12 w-12 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                      No saved draft
                    </p>
                    <p className="mt-2 max-w-sm text-sm text-muted-foreground dark:text-gray-400">
                      When you start a new listing, we can save your progress on this device. Resume
                      anytime from here.
                    </p>
                  </div>
                  <Button asChild variant="success" size="lg" className="h-12 rounded-xl px-8 text-base font-semibold">
                    <Link href="/listings/new">Create new listing</Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                        Resume your draft
                      </p>
                      <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                        Saved {new Date(localDraft.savedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="default" className="h-11 rounded-xl">
                        <Link href="/listings/new">Continue editing</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl"
                        onClick={() => {
                          clearListingDraftLocal();
                          setLocalDraft(null);
                          toast({ title: "Draft discarded" });
                        }}
                      >
                        Discard
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {viewTab === "active" && displayRows.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center dark:border-gray-800 dark:bg-gray-900/40">
              <ClipboardList className="h-12 w-12 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                  Nothing active right now
                </p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground dark:text-gray-400">
                  When an auction is live or a job is underway, it will show up here. Try All to see
                  past listings.
                </p>
              </div>
              <Button asChild variant="success" size="lg" className="h-12 rounded-xl px-8 text-base font-semibold">
                <Link href="/listings/new">Create new listing</Link>
              </Button>
            </div>
          )}

          {viewTab === "disputed" && displayRows.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-amber-200/80 bg-amber-50/40 px-6 py-16 text-center dark:border-amber-900/50 dark:bg-amber-950/20">
              <Scale className="h-12 w-12 text-amber-700 dark:text-amber-400" aria-hidden />
              <div>
                <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                  No open disputes
                </p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground dark:text-gray-400">
                  If something goes wrong on a job, open a dispute from the job page — it will appear here
                  so you can respond quickly.
                </p>
              </div>
            </div>
          )}

          {viewTab === "completed" && displayRows.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center dark:border-gray-800 dark:bg-gray-900/40">
              <Inbox className="h-12 w-12 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                  No completed jobs yet
                </p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground dark:text-gray-400">
                  When a cleaner finishes and payment clears, completed jobs appear here.
                </p>
              </div>
            </div>
          )}

          {viewTab === "all" && displayRows.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center dark:border-gray-800 dark:bg-gray-900/40">
              <Inbox className="h-12 w-12 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                  No listings yet
                </p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground dark:text-gray-400">
                  Publish your first bond clean listing to start receiving bids.
                </p>
              </div>
              <Button asChild variant="success" size="lg" className="h-12 rounded-xl px-8 text-base font-semibold">
                <Link href="/listings/new">Create new listing</Link>
              </Button>
            </div>
          )}

          {viewTab !== "drafts" &&
            displayRows.map((listing) => {
              const job = activeJobs[String(listing.id)] ?? null;

              if (viewTab === "disputed") {
                if (!job) return null;
                const amount =
                  job.agreed_amount_cents ??
                  listing.current_lowest_bid_cents ??
                  0;
                return (
                  <ListerDisputedCard
                    key={String(listing.id)}
                    listing={listing}
                    job={{
                      jobId: job.jobId,
                      status: job.status,
                      dispute_reason: job.dispute_reason,
                      dispute_status: job.dispute_status,
                      dispute_opened_by: job.dispute_opened_by,
                      disputed_at: job.disputed_at,
                      cleaner_confirmed_complete: job.cleanerConfirmedComplete,
                      agreed_amount_cents: job.agreed_amount_cents,
                    }}
                    addressLine={addressLine(listing)}
                    amountCents={amount}
                  />
                );
              }

              const badge = classifyListerBadge(listing, job, nowMs);
              const timeLabel = buildTimeLabel(listing, job, nowMs);
              const bids = bidCounts[String(listing.id)] ?? 0;
              const highest = listing.current_lowest_bid_cents ?? 0;
              const buyNow = listing.buy_now_cents ?? null;
              const liveBidding = isListerAuctionLiveBidding(listing, job, nowMs);
              const showEndEarly =
                liveBidding && !activeIdSet.has(String(listing.id));
              const isExpired =
                String(listing.status ?? "").toLowerCase() === "expired";

              return (
                <ListerListingCard
                  key={String(listing.id)}
                  listing={listing}
                  addressLine={addressLine(listing)}
                  badgeLabel={badge.label}
                  badgeTone={badge.tone}
                  bidCount={bids}
                  highestBidCents={highest}
                  buyNowCents={buyNow}
                  timeLabel={timeLabel}
                  isLiveBidding={liveBidding}
                  showEndEarly={showEndEarly}
                  href={hrefListingOrJob(
                    {
                      id: String(listing.id),
                      status: listing.status,
                      end_time: listing.end_time,
                    },
                    job && job.jobId != null
                      ? {
                          id: Number(job.jobId),
                          winner_id: job.winnerId,
                          cleaner_id: job.winnerId,
                          status: job.status,
                        }
                      : null
                  )}
                  onEndEarly={showEndEarly ? () => openCancelListingConfirm(listing) : undefined}
                  onRelist={
                    isExpired
                      ? () => void handleRelist(String(listing.id))
                      : undefined
                  }
                  relistLoading={relistingId === String(listing.id)}
                />
              );
            })}
        </div>
      </div>

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
                  Update photos for this listing.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeEditor}>
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
                                    description: editDescription.trim() || null,
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
                                      description: editDescription.trim() || null,
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
                  <label
                    className={cn(
                      "flex h-20 w-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-muted-foreground/50 bg-muted/40 text-[11px] text-muted-foreground hover:bg-muted/70 dark:border-gray-600 dark:bg-gray-800",
                      editPhotoUrls.length >= PHOTO_LIMITS.LISTING_EDIT &&
                        "pointer-events-none opacity-60"
                    )}
                  >
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
                {editError && <p className="text-xs text-destructive">{editError}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={closeEditor} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="max-h-[90vh] max-w-3xl overflow-hidden rounded-lg bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Listing photo"
              loading="eager"
              decoding="async"
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      )}

      <Dialog
        open={cancelListingTarget !== null}
        onOpenChange={(open) => {
          if (!open && !cancellingListing) setCancelListingTarget(null);
        }}
      >
        <DialogContent className="max-w-md dark:border-gray-700 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>End this auction early?</DialogTitle>
            <DialogDescription className="text-left">
              This will end the auction early. No new bids will be accepted. The listing stays in your
              history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelListingTarget(null)}
              disabled={cancellingListing}
            >
              Keep listing live
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancellingListing}
              onClick={() => void handleConfirmCancelListing()}
            >
              {cancellingListing ? "Ending…" : "Yes, end early"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PullToRefresh>
  );
}
