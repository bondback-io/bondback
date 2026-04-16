"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2, Eye, EyeOff, Flag, ShieldCheck } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { StarDistribution } from "@/lib/admin/admin-reviews-stats";
import { adminDeleteReview, adminUpdateReviewModeration } from "@/lib/actions/admin-reviews";
import { reviewPhotoPublicUrl } from "@/lib/reviews/review-photo-public-url";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { AdminReviewsDistribution } from "@/components/admin/admin-reviews-distribution";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type AdminReviewProfileMini = {
  id: string;
  full_name: string | null;
  cleaner_username: string | null;
};

export type AdminReviewTableRow = {
  id: number;
  job_id: number;
  reviewer_id: string;
  reviewee_id: string;
  reviewee_type: string | null;
  reviewee_role: string | null;
  overall_rating: number;
  quality_of_work: number | null;
  reliability: number | null;
  communication: number | null;
  punctuality: number | null;
  review_text: string | null;
  review_photos: string[] | null;
  created_at: string;
  is_approved: boolean;
  is_hidden: boolean;
  is_flagged: boolean;
  moderation_note: string | null;
  moderated_at: string | null;
};

function displayName(p: AdminReviewProfileMini | undefined): string {
  if (!p) return "—";
  const u = (p.cleaner_username ?? "").trim();
  if (u) return `@${u}`;
  return (p.full_name ?? "").trim() || "—";
}

function revieweeKind(r: AdminReviewTableRow): "Cleaner" | "Lister" {
  const t = String(r.reviewee_type ?? r.reviewee_role ?? "").toLowerCase();
  return t === "lister" ? "Lister" : "Cleaner";
}

function statusBadge(r: AdminReviewTableRow) {
  if (r.is_hidden) {
    return (
      <Badge variant="secondary" className="dark:bg-gray-800">
        Hidden
      </Badge>
    );
  }
  if (!r.is_approved) {
    return (
      <Badge variant="outline" className="border-amber-300 text-amber-900 dark:border-amber-700 dark:text-amber-100">
        Pending
      </Badge>
    );
  }
  if (r.is_flagged) {
    return (
      <Badge variant="destructive" className="font-medium">
        Flagged
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-600 hover:bg-emerald-600 dark:bg-emerald-700">Approved</Badge>
  );
}

function StarRow({ value, label }: { value: number | null | undefined; label?: string }) {
  if (value == null) return null;
  const n = Math.min(5, Math.max(1, Math.round(Number(value))));
  return (
    <div className="flex items-center gap-2 text-sm">
      {label ? (
        <span className="w-28 shrink-0 text-muted-foreground dark:text-gray-400">{label}</span>
      ) : null}
      <div className="flex gap-0.5" aria-label={`${n} of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              i < n
                ? "fill-amber-400 text-amber-400 dark:fill-amber-500 dark:text-amber-500"
                : "text-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </div>
  );
}

export type AdminReviewsClientProps = {
  reviews: AdminReviewTableRow[];
  profilesById: Record<string, AdminReviewProfileMini>;
  stats: { total: number; average: number | null; distribution: StarDistribution };
  totalFiltered: number;
  page: number;
  pageSize: number;
  readOnly: boolean;
  prevUrl: string | null;
  nextUrl: string | null;
};

export function AdminReviewsClient({
  reviews,
  profilesById,
  stats,
  totalFiltered,
  page,
  pageSize,
  readOnly,
  prevUrl,
  nextUrl,
}: AdminReviewsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<AdminReviewTableRow | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("admin-reviews-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews" },
        () => {
          router.refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const openReview = useCallback((r: AdminReviewTableRow) => {
    setActive(r);
    setNoteDraft(r.moderation_note ?? "");
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setActive(null);
  }, []);

  const onModeration = useCallback(
    (patch: {
      is_approved?: boolean;
      is_hidden?: boolean;
      is_flagged?: boolean;
      moderation_note?: string | null;
    }) => {
      if (!active || readOnly) return;
      startTransition(async () => {
        const res = await adminUpdateReviewModeration({
          reviewId: active.id,
          ...patch,
        });
        if (!res.ok) {
          toast({ variant: "destructive", title: "Update failed", description: res.error });
          return;
        }
        toast({ title: "Review updated" });
        router.refresh();
        closeModal();
      });
    },
    [active, closeModal, readOnly, router, toast]
  );

  const onDelete = useCallback(() => {
    if (!active || readOnly) return;
    if (!window.confirm("Permanently delete this review? Profile aggregates will be recomputed.")) return;
    startTransition(async () => {
      const res = await adminDeleteReview(active.id);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Delete failed", description: res.error });
        return;
      }
      toast({ title: "Review deleted" });
      router.refresh();
      closeModal();
    });
  }, [active, closeModal, readOnly, router, toast]);

  const preview = useMemo(
    () => (text: string | null) => {
      const t = (text ?? "").trim();
      if (!t) return "—";
      return t.length > 100 ? `${t.slice(0, 100)}…` : t;
    },
    []
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
            Average rating
          </p>
          <p className="mt-1 flex items-baseline gap-2 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
            {stats.average != null ? stats.average.toFixed(2) : "—"}
            <Star className="inline h-5 w-5 shrink-0 fill-amber-400 text-amber-400 dark:fill-amber-500 dark:text-amber-500" />
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground dark:text-gray-500">All reviews in database</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
            Total reviews
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 sm:col-span-2 dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
          <AdminReviewsDistribution distribution={stats.distribution} total={stats.total} />
        </div>
      </div>

      {readOnly && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Set <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">SUPABASE_SERVICE_ROLE_KEY</code> on
          the server to load reviews and run moderation actions.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border dark:border-gray-800">
        <Table>
          <TableHeader>
            <TableRow className="dark:border-gray-800">
              <TableHead className="dark:text-gray-300">Reviewer</TableHead>
              <TableHead className="dark:text-gray-300">Reviewee</TableHead>
              <TableHead className="dark:text-gray-300">Role</TableHead>
              <TableHead className="w-[72px] dark:text-gray-300">Job</TableHead>
              <TableHead className="dark:text-gray-300">Rating</TableHead>
              <TableHead className="min-w-[140px] dark:text-gray-300">Comment</TableHead>
              <TableHead className="dark:text-gray-300">Date</TableHead>
              <TableHead className="dark:text-gray-300">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground dark:text-gray-400">
                  No reviews match these filters.
                </TableCell>
              </TableRow>
            ) : (
              reviews.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/60 dark:hover:bg-gray-900/60"
                  onClick={() => openReview(r)}
                >
                  <TableCell className="max-w-[140px] truncate text-sm dark:text-gray-200">
                    {displayName(profilesById[r.reviewer_id])}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-sm dark:text-gray-200">
                    {displayName(profilesById[r.reviewee_id])}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground dark:text-gray-400">{revieweeKind(r)}</TableCell>
                  <TableCell className="font-mono text-xs tabular-nums dark:text-gray-300">{r.job_id}</TableCell>
                  <TableCell>
                    <StarRow value={r.overall_rating} />
                  </TableCell>
                  <TableCell className="max-w-[220px] text-xs text-muted-foreground dark:text-gray-400">
                    {preview(r.review_text)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground dark:text-gray-400">
                    {format(new Date(r.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>{statusBadge(r)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground dark:text-gray-400">
        <span>
          Page {page} of {totalPages} · {totalFiltered} result{totalFiltered === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!prevUrl} asChild>
            <a href={prevUrl ?? "#"} aria-disabled={!prevUrl}>
              Previous
            </a>
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!nextUrl} asChild>
            <a href={nextUrl ?? "#"} aria-disabled={!nextUrl}>
              Next
            </a>
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto dark:border-gray-700 dark:bg-gray-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Review #{active?.id}</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Job {active?.job_id} · {active ? format(new Date(active.created_at), "PPp") : ""}
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground dark:text-gray-500">Reviewer</p>
                  <p className="font-medium dark:text-gray-100">{displayName(profilesById[active.reviewer_id])}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground dark:text-gray-500">Reviewee ({revieweeKind(active)})</p>
                  <p className="font-medium dark:text-gray-100">{displayName(profilesById[active.reviewee_id])}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">{statusBadge(active)}</div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground dark:text-gray-500">Overall</p>
                <StarRow value={active.overall_rating} />
              </div>
              {revieweeKind(active) === "Cleaner" && (
                <div className="space-y-1 rounded-lg border border-border p-3 dark:border-gray-800">
                  <p className="text-xs font-medium text-muted-foreground dark:text-gray-500">Category scores</p>
                  <StarRow value={active.quality_of_work} label="Quality" />
                  <StarRow value={active.reliability} label="Reliability" />
                  <StarRow value={active.communication} label="Communication" />
                  <StarRow value={active.punctuality} label="Punctuality" />
                </div>
              )}
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground dark:text-gray-500">Comment</p>
                <p className="whitespace-pre-wrap text-sm text-foreground dark:text-gray-200">
                  {(active.review_text ?? "").trim() || "—"}
                </p>
              </div>
              {active.review_photos && active.review_photos.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground dark:text-gray-500">Photos</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {active.review_photos.map((path) => (
                      <a
                        key={path}
                        href={reviewPhotoPublicUrl(path)}
                        target="_blank"
                        rel="noreferrer"
                        className="block aspect-square overflow-hidden rounded-md border border-border dark:border-gray-700"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={reviewPhotoPublicUrl(path)}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="mod-note" className="text-xs dark:text-gray-300">
                  Moderation note (optional)
                </Label>
                <Textarea
                  id="mod-note"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
                  className="dark:border-gray-700 dark:bg-gray-950"
                  disabled={readOnly || pending}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="default"
                className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={readOnly || pending || !active}
                onClick={() =>
                  onModeration({
                    is_approved: true,
                    is_hidden: false,
                    is_flagged: false,
                    moderation_note: noteDraft.trim() || null,
                  })
                }
              >
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={readOnly || pending || !active}
                onClick={() =>
                  onModeration({
                    is_hidden: !active?.is_hidden,
                    moderation_note: noteDraft.trim() || null,
                  })
                }
              >
                {active?.is_hidden ? (
                  <>
                    <Eye className="h-4 w-4" aria-hidden />
                    Show
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" aria-hidden />
                    Hide
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={readOnly || pending || !active}
                onClick={() =>
                  onModeration({
                    is_flagged: !active?.is_flagged,
                    moderation_note: noteDraft.trim() || null,
                  })
                }
              >
                <Flag className="h-4 w-4" aria-hidden />
                {active?.is_flagged ? "Unflag" : "Flag"}
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="gap-1"
              disabled={readOnly || pending || !active}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
