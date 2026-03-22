"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Landmark } from "lucide-react";
import { createStripeConnectAccount } from "@/lib/actions/stripe-connect";
import { useToast } from "@/components/ui/use-toast";

export type ConnectRequiredModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** When true, primary action starts Stripe onboarding (redirect). Otherwise link to profile. */
  startOnboarding?: boolean;
};

export function ConnectRequiredModal({
  open,
  onOpenChange,
  userId,
  startOnboarding = true,
}: ConnectRequiredModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    if (!startOnboarding) return;
    setLoading(true);
    try {
      const result = await createStripeConnectAccount(userId);
      if (result.ok) {
        window.location.href = result.onboardingUrl;
        return;
      }
      toast({
        variant: "destructive",
        title: "Could not start setup",
        description: result.error,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <DialogTitle>Connect bank account</DialogTitle>
          </div>
          <DialogDescription>
            Please connect your bank account to receive payment. You need to complete Stripe Connect onboarding before you can receive payouts from jobs.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          {startOnboarding ? (
            <Button
              onClick={handleConnect}
              disabled={loading}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {loading ? "Starting…" : "Connect Bank Account for Payouts"}
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/profile" onClick={() => onOpenChange(false)}>
              Go to Profile
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
