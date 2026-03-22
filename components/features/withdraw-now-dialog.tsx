"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getConnectBalance, createInstantPayout } from "@/lib/actions/stripe-connect";
import { estimateInstantPayoutFeeCents } from "@/lib/instant-payout-fee";
import { formatCents } from "@/lib/listings";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

type WithdrawNowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess?: () => void;
};

export function WithdrawNowDialog({
  open,
  onOpenChange,
  userId,
  onSuccess,
}: WithdrawNowDialogProps) {
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !userId) return;
    setError(null);
    setBalanceCents(null);
    setLoading(true);
    getConnectBalance(userId)
      .then((res) => {
        if (res.ok) setBalanceCents(res.availableCents);
        else setError(res.error);
      })
      .finally(() => setLoading(false));
  }, [open, userId]);

  const feeCents = balanceCents != null && balanceCents > 0 ? estimateInstantPayoutFeeCents(balanceCents) : 0;
  const receiveCents = balanceCents != null && balanceCents > 0 ? balanceCents - feeCents : 0;
  const canWithdraw = balanceCents != null && balanceCents >= 100; // min $1 after fee consideration

  const handleConfirm = async () => {
    if (!canWithdraw) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createInstantPayout(userId);
      if (res.ok) {
        toast({
          title: "Instant payout requested",
          description: "Funds usually arrive in minutes. You paid the instant transfer fee.",
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError(res.error);
        toast({ variant: "destructive", title: "Payout failed", description: res.error });
      }
    } catch {
      setError("Something went wrong.");
      toast({ variant: "destructive", title: "Payout failed", description: "Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md dark:border-gray-800 dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="dark:text-gray-100">Request instant payout?</DialogTitle>
          <DialogDescription className="dark:text-gray-400">
            You will pay Stripe&apos;s instant transfer fee of 1% (min $1 AUD). Funds usually arrive in minutes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking balance…
            </div>
          )}
          {!loading && balanceCents != null && (
            <>
              <p className="text-sm dark:text-gray-200">
                Available balance: <strong>{formatCents(balanceCents)}</strong>
              </p>
              <p className="text-sm dark:text-gray-200">
                Estimated fee:{" "}
                <Badge variant="secondary" className="font-mono text-xs">
                  {formatCents(feeCents)} (1% of {formatCents(balanceCents)})
                </Badge>
              </p>
              <p className="text-sm dark:text-gray-200">
                You&apos;ll receive approximately <strong>{formatCents(receiveCents)}</strong> in your bank.
              </p>
            </>
          )}
          {!loading && balanceCents !== null && balanceCents < 100 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Not enough balance for instant payout (minimum after fee is $1 AUD).
            </p>
          )}
          {error && !loading && (
            <p className="text-sm text-destructive dark:text-red-400">{error}</p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading || submitting || !canWithdraw}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              "Confirm instant payout"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
