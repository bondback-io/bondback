"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cancelEscrowJobNonResponsiveCleaner } from "@/lib/actions/jobs";
import type { ListerNonResponsiveCancelPreview } from "@/lib/jobs/lister-nonresponsive-cancel";
import { useToast } from "@/components/ui/use-toast";

function formatAud(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export function ListerNonresponsiveCancelMenu({
  jobId,
  preview,
}: {
  jobId: number;
  preview: ListerNonResponsiveCancelPreview;
}) {
  if (!preview.eligible) {
    return (
      <div className="flex w-full flex-col gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/25 sm:max-w-md sm:items-end sm:py-2">
        <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
          Cancel after escrow (non-responsive cleaner)
        </p>
        <p className="text-left text-[11px] leading-snug text-amber-900/90 dark:text-amber-200/90">
          {preview.reason}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full shrink-0 border-amber-300/90 text-amber-950 disabled:opacity-70 dark:border-amber-800 dark:text-amber-100 sm:ml-auto sm:w-auto"
          disabled
          aria-disabled
        >
          Not available yet
        </Button>
      </div>
    );
  }

  return <ListerNonresponsiveCancelMenuEligible jobId={jobId} preview={preview} />;
}

function ListerNonresponsiveCancelMenuEligible({
  jobId,
  preview,
}: {
  jobId: number;
  preview: Extract<ListerNonResponsiveCancelPreview, { eligible: true }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setStep(1);
    setConfirmText("");
  }

  function closeDialog() {
    setOpen(false);
    reset();
  }

  function submitFinal() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("jobId", String(jobId));
      fd.set("confirm", confirmText.trim());
      const r = await cancelEscrowJobNonResponsiveCleaner(fd);
      if (!r.ok) {
        toast({
          variant: "destructive",
          title: "Could not cancel job",
          description: r.error,
        });
        return;
      }
      toast({
        title: "Job cancelled",
        description: `Refund of ${formatAud(r.refundCents)} is processing. Bond Back retained ${formatAud(r.cancellationFeeCents)}.`,
      });
      closeDialog();
      router.refresh();
    });
  }

  const confirmOk = confirmText.trim() === "CANCEL";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-amber-200/90 px-3 text-xs font-medium text-amber-950 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-950/40"
            aria-label="Cancel job options"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
            Cancel job
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[min(100vw-2rem,280px)]">
          <DropdownMenuItem
            className="text-xs text-muted-foreground focus:text-foreground dark:text-gray-400 dark:focus:text-gray-100"
            onSelect={(e) => {
              e.preventDefault();
              setOpen(true);
              reset();
            }}
          >
            Cancel Job – Cleaner Non-Responsive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) closeDialog();
          else setOpen(true);
        }}
      >
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto border-border bg-card dark:border-gray-800 dark:bg-gray-950 sm:max-w-lg">
          {step === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">Cancel for non-responsive cleaner?</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-3 pt-1 text-left text-sm text-muted-foreground dark:text-gray-400">
                    <p>
                      {preview.requiredIdleDays <= 0
                        ? "Use this only when the cleaner is not completing the work and is not responsive in line with your agreement. Site policy does not require a long inactivity wait for this path."
                        : preview.requiredIdleDays === 1
                          ? "This action should only be used when the cleaner has been completely non-responsive for at least 1 full day."
                          : `This action should only be used when the cleaner has been completely non-responsive for at least ${preview.requiredIdleDays} full days.`}
                    </p>
                    <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                      <p className="font-semibold text-foreground dark:text-gray-50">Cancelling will:</p>
                      <ul className="mt-2 list-inside list-disc space-y-1">
                        <li>
                          Refund your payment minus a cancellation fee (max $50 — here:{" "}
                          <strong>{formatAud(preview.cancellationFeeCents)}</strong>, refund approx{" "}
                          <strong>{formatAud(preview.refundCents)}</strong>)
                        </li>
                        <li>Apply 1 negative star to the cleaner&apos;s profile</li>
                        <li>Risk a 3-month ban if they reach 3 negative stars</li>
                      </ul>
                    </div>
                    <p className="font-medium text-foreground dark:text-gray-200">
                      Are you sure you want to proceed?
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Back
                </Button>
                <Button type="button" onClick={() => setStep(2)}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">Final confirmation</DialogTitle>
                <DialogDescription className="text-left text-sm">
                  Type <span className="font-mono font-semibold">CANCEL</span> to enable the button below.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Alert variant="destructive" className="border-red-300/80 dark:border-red-900/60">
                  <AlertDescription>
                    This action cannot be undone and will negatively impact the cleaner&apos;s reputation.
                  </AlertDescription>
                </Alert>
                <div>
                  <Label htmlFor={`cancel-confirm-${jobId}`} className="text-xs">
                    Confirmation
                  </Label>
                  <Input
                    id={`cancel-confirm-${jobId}`}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="CANCEL"
                    autoComplete="off"
                    className="mt-1 font-mono dark:bg-gray-900"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={pending}>
                  Back
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!confirmOk || pending}
                  onClick={submitFinal}
                >
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Processing…
                    </>
                  ) : (
                    "Cancel job & refund"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
