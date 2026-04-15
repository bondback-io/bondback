"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/listings";
import {
  JOB_TOP_UP_MIN_CENTS,
  JOB_TOP_UP_STEP_CENTS,
  isValidJobTopUpAgreedCents,
} from "@/lib/job-top-up";
import { useToast } from "@/components/ui/use-toast";

export type ListerJobTopUpModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  feePercentage: number;
};

export function ListerJobTopUpModal({
  open,
  onOpenChange,
  jobId,
  feePercentage,
}: ListerJobTopUpModalProps) {
  const { toast } = useToast();
  const [amountDollars, setAmountDollars] = useState(20);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const agreedCents = amountDollars * 100;
  const feeCents = Math.round((agreedCents * feePercentage) / 100);
  const totalCents = agreedCents + feeCents;
  const valid = isValidJobTopUpAgreedCents(agreedCents);

  const bump = (deltaDollars: number) => {
    setAmountDollars((d) => Math.max(JOB_TOP_UP_MIN_CENTS / 100, d + deltaDollars));
  };

  const handleSubmit = () => {
    if (!valid) return;
    startTransition(async () => {
      try {
        const { createJobTopUpCheckoutSession } = await import("@/lib/actions/jobs");
        const res = await createJobTopUpCheckoutSession(
          jobId,
          agreedCents,
          note.trim() || null
        );
        if (!res.ok) {
          toast({ variant: "destructive", title: "Top-up failed", description: res.error });
          return;
        }
        window.location.href = res.url;
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Top-up failed",
          description: e instanceof Error ? e.message : "Could not start checkout.",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 border-border dark:border-gray-700 dark:bg-gray-950 sm:max-w-lg">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-lg dark:text-gray-100">Top Up Payment</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground dark:text-gray-400">
              <p>
                This creates a <strong className="text-foreground dark:text-gray-200">new</strong>{" "}
                Stripe payment (separate from your original Pay &amp; Start charge). Funds are held
                in escrow until you finalize and release.
              </p>
              <p className="rounded-lg border border-sky-200/80 bg-sky-50/90 px-3 py-2 text-xs leading-snug text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-100">
                You will pay{" "}
                <strong className="tabular-nums text-foreground dark:text-sky-50">
                  {formatCents(totalCents)}
                </strong>{" "}
                total: job top-up{" "}
                <span className="tabular-nums">{formatCents(agreedCents)}</span> +{" "}
                {feePercentage}% fee{" "}
                <span className="tabular-nums">{formatCents(feeCents)}</span>.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="top-up-amount" className="dark:text-gray-200">
              Amount (AUD)
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                disabled={pending || agreedCents <= JOB_TOP_UP_MIN_CENTS}
                onClick={() => bump(-(JOB_TOP_UP_STEP_CENTS / 100))}
                aria-label="Decrease by ten dollars"
              >
                −
              </Button>
              <div className="min-w-[6rem] flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-center text-lg font-semibold tabular-nums dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-100">
                ${amountDollars.toFixed(0)}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                disabled={pending}
                onClick={() => bump(JOB_TOP_UP_STEP_CENTS / 100)}
                aria-label="Increase by ten dollars"
              >
                +
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground dark:text-gray-500">
              Minimum ${JOB_TOP_UP_MIN_CENTS / 100}, then +${JOB_TOP_UP_STEP_CENTS / 100} steps.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="top-up-note" className="dark:text-gray-200">
              Reason for top-up <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="top-up-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder="e.g. Extra oven clean, garage added, agreed scope change…"
              rows={3}
              className="resize-none text-sm dark:border-gray-700 dark:bg-gray-900"
              disabled={pending}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending || !valid} className="min-h-11">
            {pending ? "Redirecting…" : "Continue to secure payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
