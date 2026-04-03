"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createListerSetupSession,
  disconnectListerPaymentMethod,
} from "@/app/settings/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle2, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  STRIPE_POPUP_MESSAGE_LISTER_SETUP,
  isStripePopupListerSetupMessage,
  openStripePopup,
} from "@/lib/stripe-popup-messaging";

export type ConnectPaymentMethodProps = {
  userId: string;
  stripePaymentMethodId: string | null;
  isLister: boolean;
};

export function ConnectPaymentMethod({
  userId: _userId,
  stripePaymentMethodId,
  isLister,
}: ConnectPaymentMethodProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!isStripePopupListerSetupMessage(e.data)) return;
      if (e.data.type !== STRIPE_POPUP_MESSAGE_LISTER_SETUP) return;
      setConnectDialogOpen(false);
      setLoading(false);
      if (e.data.cancelled) {
        toast({ title: "Setup cancelled", description: "No changes were saved." });
        return;
      }
      if (e.data.ok) {
        toast({
          title: "Payment method saved",
          description: "Your card is connected for Pay & Start Job.",
        });
        router.refresh();
      } else if (e.data.error) {
        toast({
          variant: "destructive",
          title: "Could not save card",
          description: e.data.error,
        });
        router.refresh();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router, toast]);

  const startStripePopup = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await createListerSetupSession({ popup: true });
      if (!result) {
        toast({
          variant: "destructive",
          title: "Could not start setup",
          description: "No response. Please try again.",
        });
        return;
      }
      if (result.ok && result.url) {
        const win = openStripePopup(result.url, "bondback_stripe_lister_setup");
        if (!win) {
          toast({
            variant: "destructive",
            title: "Popup blocked",
            description: "Allow popups for this site to add your card.",
          });
        }
        return;
      }
      toast({
        variant: "destructive",
        title: "Could not start setup",
        description: !result.ok ? result.error : "Missing redirect URL.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [loading, toast]);

  const handleOpenConnectFlow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConnectDialogOpen(true);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await disconnectListerPaymentMethod();
      if (result.ok) {
        toast({
          title: "Payment method removed",
          description: "You can connect a different card when you're ready.",
        });
        setDisconnectDialogOpen(false);
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Could not disconnect", description: result.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Could not disconnect", description: "Please try again." });
    } finally {
      setDisconnecting(false);
    }
  };

  if (!isLister) return null;

  const isTestMode =
    typeof process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY === "string" &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith("pk_test");

  return (
    <Card className="max-w-xl border-border dark:border-gray-800 dark:bg-gray-950/95 dark:text-gray-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base dark:text-gray-100">
          <CreditCard className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          Payment method (for Pay &amp; Start Job)
        </CardTitle>
        <CardDescription className="dark:text-gray-400">
          Save a card to pay and start jobs in one click. Funds are held in escrow until you approve release.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
          <DialogContent className="max-w-md dark:border-gray-800 dark:bg-gray-950">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 dark:text-gray-100">
                <ExternalLink className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                Stripe opens in a new window
              </DialogTitle>
              <DialogDescription className="text-left dark:text-gray-400">
                Add or update your card on Stripe’s secure checkout. When you’re done, we’ll update this page automatically. You can close this dialog anytime.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
              <Button
                type="button"
                className="w-full gap-2 bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500"
                disabled={loading}
                onClick={() => void startStripePopup()}
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
              <Button type="button" variant="ghost" className="w-full" onClick={() => setConnectDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
          <DialogContent className="max-w-md dark:border-gray-800 dark:bg-gray-950">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">Remove saved card?</DialogTitle>
              <DialogDescription className="text-left dark:text-gray-400">
                You’ll need to add a card again before Pay &amp; Start Job. Use this if you want to use a different card or Stripe customer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDisconnectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={disconnecting}
                onClick={() => void handleDisconnect()}
              >
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove card"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {stripePaymentMethodId ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>Payment method connected. You can use Pay &amp; Start Job without leaving the page.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={handleOpenConnectFlow}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update card"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setDisconnectDialogOpen(true)}
              >
                Remove card
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleOpenConnectFlow}
            disabled={loading}
            aria-busy={loading}
            className="gap-2 bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                {isTestMode ? "Add Test Payment Method" : "Connect Payment Method"}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
