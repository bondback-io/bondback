"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Landmark, Loader2 } from "lucide-react";
import { createConnectAccount } from "@/lib/actions/stripe-connect";
import { useToast } from "@/components/ui/use-toast";
import {
  STRIPE_POPUP_MESSAGE_CONNECT,
  isStripePopupConnectMessage,
  openStripePopup,
  prefersSameTabStripeConnect,
} from "@/lib/stripe-popup-messaging";

export type ConnectRequiredModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** When true, primary action opens Stripe Connect in a popup. Otherwise link to profile. */
  startOnboarding?: boolean;
};

export function ConnectRequiredModal({
  open,
  onOpenChange,
  userId,
  startOnboarding = true,
}: ConnectRequiredModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!isStripePopupConnectMessage(e.data)) return;
      if (e.data.type !== STRIPE_POPUP_MESSAGE_CONNECT) return;
      if (e.data.ok) {
        toast({
          title: "Payout account updated",
          description: "Your Stripe Connect status has been refreshed.",
        });
        onOpenChange(false);
        router.refresh();
      } else if (e.data.error) {
        toast({
          variant: "destructive",
          title: "Connect setup issue",
          description: e.data.error,
        });
        router.refresh();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onOpenChange, router, toast]);

  const handleOpenStripe = useCallback(async () => {
    if (!startOnboarding) return;
    setLoading(true);
    try {
      if (prefersSameTabStripeConnect()) {
        const result = await createConnectAccount(userId, { popupReturn: false });
        if (result.ok) {
          window.location.assign(result.onboardingUrl);
          return;
        }
        toast({
          variant: "destructive",
          title: "Could not start setup",
          description: result.error,
        });
        return;
      }

      const result = await createConnectAccount(userId, { popupReturn: true });
      if (result.ok) {
        const win = openStripePopup(result.onboardingUrl, "bondback_stripe_connect");
        if (win) return;
        const again = await createConnectAccount(userId, { popupReturn: false });
        if (again.ok) {
          toast({
            title: "Continuing in this tab",
            description: "Stripe will open here so you can finish setup.",
          });
          window.location.assign(again.onboardingUrl);
          return;
        }
        toast({
          variant: "destructive",
          title: "Could not open Stripe",
          description: again.error,
        });
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
  }, [startOnboarding, userId, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md dark:border-gray-800 dark:bg-gray-950">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <DialogTitle className="dark:text-gray-100">Connect bank account</DialogTitle>
          </div>
          <DialogDescription className="dark:text-gray-400">
            Complete Stripe Connect onboarding to receive payouts. On phones, Stripe opens in this tab. On larger screens, a separate window may open; if your browser blocks it, we continue in this tab instead.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-start">
          {startOnboarding ? (
            <Button
              type="button"
              onClick={() => void handleOpenStripe()}
              disabled={loading}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ExternalLink className="h-4 w-4" />
                  Open Stripe
                </>
              )}
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
