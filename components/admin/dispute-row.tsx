"use client";

import Link from "next/link";
import Image from "next/image";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { adminResolveDispute } from "@/lib/actions/admin-jobs";
import {
  Eye,
  MessageCircle,
  MoreHorizontal,
  CheckCircle2,
  Receipt,
  RotateCcw,
  XCircle,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

type Job = {
  id: number;
  listing_id: string;
  lister_id: string;
  winner_id: string | null;
  status: string;
  dispute_reason: string | null;
  dispute_photos: string[] | null;
  dispute_evidence?: string[] | null;
  dispute_status?: string | null;
  dispute_opened_by?: "lister" | "cleaner" | null;
  disputed_at?: string | null;
  dispute_response_reason?: string | null;
  dispute_response_evidence?: string[] | null;
  proposed_refund_amount?: number | null;
  counter_proposal_amount?: number | null;
  payment_intent_id?: string | null;
  refund_amount?: number | null;
  refund_status?: string | null;
  created_at: string;
};

type Profile = { full_name: string | null; profile_photo_url: string | null };

export function DisputeRow({
  job,
  lister,
  cleaner,
}: {
  job: Job;
  lister: Profile | null;
  cleaner: Profile | null;
}) {
  const router = useRouter();
  const reason = job.dispute_reason ?? "No reason supplied";
  const evidence: string[] =
    job.dispute_evidence ?? job.dispute_photos ?? [];
  const disputedBy = job.dispute_opened_by ?? "lister";
  const [resolveOpen, setResolveOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [refundAmountCents, setRefundAmountCents] = useState(0);
  const [resolution, setResolution] = useState<
    "release_funds" | "partial_refund" | "full_refund" | "reject" | "return_to_review"
  >("release_funds");

  const agreedRefundCents = job.counter_proposal_amount ?? job.proposed_refund_amount ?? 0;

  const responseEvidence = (job.dispute_response_evidence as string[] | null) ?? [];

  const statusBadge =
    job.status === "disputed"
      ? { label: "Pending Review", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-800" }
      : job.status === "dispute_negotiating"
      ? { label: "Negotiating", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-800" }
      : job.status === "in_review"
      ? { label: "In Review", className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200 border-sky-200 dark:border-sky-800" }
      : job.status === "completed"
      ? { label: "Resolved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800" }
      :       job.status === "cancelled"
      ? { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-200 dark:border-red-800" }
      : job.status === "refunded" || job.status === "partially_refunded"
      ? { label: job.refund_status === "succeeded" ? "Refunded" : job.status, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800" }
      : { label: job.status, className: "bg-muted text-muted-foreground" };

  const handleResolve = async () => {
    const formData = new FormData();
    formData.set("jobId", String(job.id));
    formData.set("resolution", resolution);
    if (resolution === "partial_refund") {
      formData.set("refundAmountCents", String(refundAmountCents));
    }
    await adminResolveDispute(formData);
    setResolveOpen(false);
    router.refresh();
  };

  return (
    <TooltipProvider>
      <TableRow className="dark:border-gray-800">
        <TableCell className="font-medium dark:text-gray-100">
          <Link
            href={`/jobs/${job.id}`}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            #{job.id}
          </Link>
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
              {lister?.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lister.profile_photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                  {(lister?.full_name ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <span className="truncate text-sm dark:text-gray-100">{lister?.full_name ?? "—"}</span>
          </div>
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
              {cleaner?.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cleaner.profile_photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                  {(cleaner?.full_name ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <span className="truncate text-sm dark:text-gray-100">{cleaner?.full_name ?? "—"}</span>
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <Badge variant="secondary" className="text-[10px] dark:bg-gray-800 dark:text-gray-200">
            {disputedBy === "cleaner" ? "Cleaner" : "Lister"}
          </Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap text-xs dark:text-gray-200">
          {agreedRefundCents > 0 ? formatCents(agreedRefundCents) : "—"}
        </TableCell>
        <TableCell className="max-w-[180px]">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="line-clamp-2 cursor-default text-xs text-muted-foreground dark:text-gray-400">
                {reason}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm">
              {reason}
            </TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell className="hidden sm:table-cell">
          {evidence.length > 0 ? (
            <div className="flex gap-1">
              {evidence.slice(0, 3).map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setEvidenceOpen(true)}
                  className="relative h-9 w-9 shrink-0 overflow-hidden rounded border border-border bg-muted dark:border-gray-700"
                  aria-label={`View evidence photo ${idx + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              {evidence.length > 3 && (
                <span className="flex h-9 items-center text-[10px] text-muted-foreground">+{evidence.length - 3}</span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground dark:text-gray-500">None</span>
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground dark:text-gray-400">
          {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={statusBadge.className}>
            {statusBadge.label}
          </Badge>
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 dark:bg-gray-900 dark:border-gray-800">
              <DropdownMenuItem asChild>
                <Link href={`/jobs/${job.id}`} className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setRefundAmountCents(agreedRefundCents);
                  setResolveOpen(true);
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Resolve
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/messages?job=${job.id}`} className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Message Parties
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* Evidence modal: reason, response, photos */}
      <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DialogContent className="max-w-2xl dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle>View evidence — Job #{job.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-medium uppercase text-muted-foreground dark:text-gray-400">Dispute reason ({disputedBy})</p>
              <p className="mt-1 whitespace-pre-wrap text-sm dark:text-gray-200">{reason}</p>
            </div>
            {evidence.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase text-muted-foreground dark:text-gray-400">Evidence photos</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {evidence.map((url, idx) => (
                    <div key={idx} className="relative aspect-square overflow-hidden rounded-md border bg-muted dark:border-gray-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Evidence ${idx + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {job.dispute_response_reason && (
              <div>
                <p className="text-[11px] font-medium uppercase text-muted-foreground dark:text-gray-400">Response (other party)</p>
                <p className="mt-1 whitespace-pre-wrap text-sm dark:text-gray-200">{job.dispute_response_reason}</p>
              </div>
            )}
            {responseEvidence.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase text-muted-foreground dark:text-gray-400">Response photos</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {responseEvidence.map((url, idx) => (
                    <div key={idx} className="relative aspect-square overflow-hidden rounded-md border bg-muted dark:border-gray-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Response ${idx + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {evidence.length === 0 && responseEvidence.length === 0 && !job.dispute_response_reason && (
              <p className="text-sm text-muted-foreground">No evidence photos uploaded.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolve dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle>Resolve dispute — Job #{job.id}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Choose an outcome. Escrow release/refund can be wired here.
          </p>
          {resolution === "partial_refund" && (
            <div className="py-2">
              <label className="text-xs font-medium text-muted-foreground dark:text-gray-400">
                Partial refund amount (cents)
              </label>
              <input
                type="number"
                min={1}
                value={refundAmountCents}
                onChange={(e) =>
                  setRefundAmountCents(
                    Math.max(0, Math.round(Number(e.target.value)))
                  )
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-muted-foreground dark:text-gray-500">
                {refundAmountCents >= 1 ? formatCents(refundAmountCents) : "—"}
              </p>
            </div>
          )}
          <div className="space-y-2">
            {[
              { value: "release_funds" as const, label: "Release Funds", desc: "Release to cleaner", icon: CheckCircle2 },
              { value: "partial_refund" as const, label: "Partial Refund", desc: "Agreed partial refund", icon: Receipt },
              { value: "full_refund" as const, label: "Full Refund", desc: "Refund lister (cancel job)", icon: RotateCcw },
              { value: "reject" as const, label: "Reject Dispute", desc: "Close dispute, no refund to lister", icon: XCircle },
              {
                value: "return_to_review" as const,
                label: "Return to review",
                desc: "Lister must approve again; new auto-release timer (no payout yet)",
                icon: Clock,
              },
            ].map(({ value, label, desc, icon: Icon }) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 has-[:checked]:ring-2 has-[:checked]:ring-ring dark:border-gray-800 dark:bg-gray-800/50"
              >
                <input
                  type="radio"
                  name="resolution"
                  value={value}
                  checked={resolution === value}
                  onChange={() => setResolution(value)}
                  className="sr-only"
                />
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium dark:text-gray-100">{label}</p>
                  <p className="text-[11px] text-muted-foreground dark:text-gray-400">{desc}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={resolution === "partial_refund" && refundAmountCents < 1}
            >
              Save resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </TooltipProvider>
  );
}
