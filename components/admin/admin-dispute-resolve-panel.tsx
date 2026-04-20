"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { adminResolveDispute } from "@/lib/actions/admin-jobs";
import { CheckCircle2, Gavel, Receipt, RotateCcw, XCircle, Clock } from "lucide-react";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type Resolution =
  | "release_funds"
  | "partial_refund"
  | "full_refund"
  | "reject"
  | "return_to_review";

export function AdminDisputeResolvePanel({
  jobId,
  jobStatus,
  suggestedRefundCents,
  agreedAmountCents,
}: {
  jobId: number;
  jobStatus: string;
  suggestedRefundCents: number;
  agreedAmountCents: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("return_to_review");
  const [refundAmountCents, setRefundAmountCents] = useState(
    Math.max(0, suggestedRefundCents || 0)
  );

  const st = String(jobStatus ?? "").toLowerCase();
  const isTerminal = st === "completed" || st === "cancelled";

  const handleResolve = async () => {
    const formData = new FormData();
    formData.set("jobId", String(jobId));
    formData.set("resolution", resolution);
    if (resolution === "partial_refund") {
      formData.set("refundAmountCents", String(refundAmountCents));
    }
    await adminResolveDispute(formData);
    setOpen(false);
    router.refresh();
  };

  if (isTerminal) {
    return (
      <p className="text-xs text-muted-foreground dark:text-gray-500">
        This job is already completed or cancelled. Use the closed queue to review history.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-300/70 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/25">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
            Close / resolve dispute
          </p>
          <p className="text-[11px] text-muted-foreground dark:text-gray-400">
            Release escrow, refund, return to lister review, or dismiss. Parties are notified.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600">
              <Gavel className="h-3.5 w-3.5" />
              Resolve dispute
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto dark:border-gray-800 dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Resolve dispute — Job #{jobId}</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              Agreed job payment in escrow:{" "}
              <strong className="text-foreground dark:text-gray-200">
                {agreedAmountCents > 0 ? formatCents(agreedAmountCents) : "—"}
              </strong>
              {suggestedRefundCents > 0 ? (
                <>
                  {" "}
                  · Suggested refund figure on file:{" "}
                  <strong className="text-foreground dark:text-gray-200">
                    {formatCents(suggestedRefundCents)}
                  </strong>
                </>
              ) : null}
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
                    setRefundAmountCents(Math.max(0, Math.round(Number(e.target.value))))
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <p className="mt-1 text-xs text-muted-foreground dark:text-gray-500">
                  {refundAmountCents >= 1 ? formatCents(refundAmountCents) : "—"}
                </p>
              </div>
            )}
            <div className="space-y-2">
              {(
                [
                  {
                    value: "return_to_review" as const,
                    label: "Return to lister review",
                    desc: "Close dispute, restart approval timer; no Stripe movement yet",
                    icon: Clock,
                  },
                  {
                    value: "release_funds" as const,
                    label: "Release funds",
                    desc: "Pay cleaner per escrow; close dispute",
                    icon: CheckCircle2,
                  },
                  {
                    value: "partial_refund" as const,
                    label: "Partial refund",
                    desc: "Refund lister amount below; complete job",
                    icon: Receipt,
                  },
                  {
                    value: "full_refund" as const,
                    label: "Full refund",
                    desc: "Refund lister; cancel job",
                    icon: RotateCcw,
                  },
                  {
                    value: "reject" as const,
                    label: "Reject (release to cleaner)",
                    desc: "No refund to lister; release to cleaner",
                    icon: XCircle,
                  },
                ] as const
              ).map(({ value, label, desc, icon: Icon }) => (
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
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleResolve()}
                disabled={resolution === "partial_refund" && refundAmountCents < 1}
                className="bg-emerald-700 hover:bg-emerald-800"
              >
                Apply resolution
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
