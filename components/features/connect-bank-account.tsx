"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createConnectAccount,
  disconnectStripeConnect,
} from "@/lib/actions/stripe-connect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Loader2, Landmark, CheckCircle2, Zap, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { showAppErrorToast } from "@/components/errors/show-app-error-toast";
import { logClientError } from "@/lib/errors/log-client-error";
import { WithdrawNowDialog } from "@/components/features/withdraw-now-dialog";
import {
  STRIPE_POPUP_MESSAGE_CONNECT,
  isStripePopupConnectMessage,
  openStripePopup,
} from "@/lib/stripe-popup-messaging";

export type ConnectBankAccountProps = {
  userId: string;
  stripeConnectId: string | null;
  stripeOnboardingComplete: boolean;
  isCleaner: boolean;
};

export function ConnectBankAccount({
  userId,
  stripeConnectId,
  stripeOnboardingComplete = false,
  isCleaner,
}: ConnectBankAccountProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!isStripePopupConnectMessage(e.data)) return;
      if (e.data.type !== STRIPE_POPUP_MESSAGE_CONNECT) return;
      setConnectDialogOpen(false);
      setLoading(false);
      if (e.data.ok) {
        toast({
          title: "Payout account updated",
          description: "Your Stripe Connect status has been refreshed.",
        });
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
  }, [router, toast]);

  const startStripePopup = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await createConnectAccount(userId, { popupReturn: true });
      if (!result) {
        logClientError("connectBank", new Error("No response"), { userId });
        showAppErrorToast(toast, {
          flow: "payment",
          error: new Error("No response from server."),
          context: "connectBank",
        });
        return;
      }
      if (result.ok) {
        const win = openStripePopup(result.onboardingUrl, "bondback_stripe_connect");
        if (!win) {
          toast({
            variant: "destructive",
            title: "Popup blocked",
            description: "Allow popups for this site, or try again.",
          });
        }
        return;
      }
      const errMsg = result.error ?? "Please try again.";
      logClientError("connectBank.createConnectAccount", errMsg, { userId });
      const isMissingColumn = /column .* does not exist/i.test(errMsg);
      const isConnectNotEnabled = /signed up for Connect|connect.*dashboard\.stripe\.com/i.test(errMsg);
      showAppErrorToast(toast, {
        flow: "payment",
        error: new Error(
          isMissingColumn
            ? "Database configuration is incomplete for payouts. Contact support or your admin."
            : isConnectNotEnabled
              ? "Stripe Connect is not enabled for this platform account."
              : errMsg
        ),
        context: "connectBank.createConnectAccount",
      });
      if (isConnectNotEnabled) {
        console.info("Enable Connect: https://dashboard.stripe.com/connect/accounts/overview");
      }
    } catch (err) {
      logClientError("connectBank.catch", err, { userId });
      showAppErrorToast(toast, {
        flow: "payment",
        error: err,
        context: "connectBank.catch",
      });
    } finally {
      setLoading(false);
    }
  }, [loading, userId, toast]);

  const handleOpenConnectFlow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConnectDialogOpen(true);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await disconnectStripeConnect();
      if (result.ok) {
        toast({
          title: "Payout connection removed",
          description: "You can connect a different Stripe account when you're ready.",
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

  if (!isCleaner) return null;

  const isConnected = !!(stripeConnectId && stripeOnboardingComplete);

  return (
    <Card className="max-w-xl border-border dark:border-gray-800 dark:bg-gray-950/95 dark:text-gray-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base dark:text-gray-100">
          <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Payouts (Stripe Connect)
        </CardTitle>
        <CardDescription className="dark:text-gray-400">
          Connect your Stripe account to receive payouts when listers approve & release funds. You receive the full bid amount; the lister pays the platform fee separately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
          <DialogContent className="max-w-md dark:border-gray-800 dark:bg-gray-950">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 dark:text-gray-100">
                <ExternalLink className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Stripe opens in a new window
              </DialogTitle>
              <DialogDescription className="text-left dark:text-gray-400">
                You’ll complete bank and identity steps on Stripe’s site. Keep this page open — when you finish, we’ll refresh your account status here automatically. You can close this dialog anytime; the Stripe window stays open.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
              <Button
                type="button"
                className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
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
              <DialogTitle className="dark:text-gray-100">Disconnect Stripe payouts?</DialogTitle>
              <DialogDescription className="text-left dark:text-gray-400">
                You won’t receive payouts until you connect again (you can use a different Stripe account). This removes the link on Bond Back; if you need help moving funds, contact support.
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
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isConnected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Connected
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={handleOpenConnectFlow}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update details"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setDisconnectDialogOpen(true)}
              >
                Disconnect Stripe
              </Button>
            </div>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Payout schedule: <strong className="text-foreground dark:text-gray-100">Automatic (2–7 business days, no fee)</strong>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setWithdrawDialogOpen(true)}
                    >
                      <Zap className="h-4 w-4" />
                      Withdraw Now
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                    Instant payout available – you pay Stripe&apos;s fee of 1% (min $1 AUD). Funds usually arrive in minutes.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <WithdrawNowDialog
              open={withdrawDialogOpen}
              onOpenChange={setWithdrawDialogOpen}
              userId={userId}
            />
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleOpenConnectFlow}
            disabled={loading}
            aria-busy={loading}
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Landmark className="h-4 w-4" />
                Connect Now
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
