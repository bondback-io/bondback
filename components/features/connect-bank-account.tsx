"use client";

import { useState } from "react";
import { createConnectAccount } from "@/lib/actions/stripe-connect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Landmark, CheckCircle2, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { WithdrawNowDialog } from "@/components/features/withdraw-now-dialog";

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
  const [loading, setLoading] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const { toast } = useToast();

  if (!isCleaner) return null;

  const isConnected = !!(stripeConnectId && stripeOnboardingComplete);

  const isTestMode =
    typeof process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY === "string" &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith("pk_test");

  const handleConnect = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const result = await createConnectAccount(userId);
      if (!result) {
        toast({
          variant: "destructive",
          title: "Could not start setup",
          description: "No response from server. Please try again.",
        });
        return;
      }
      if (result.ok) {
        if (result.onboardingUrl) {
          window.location.href = result.onboardingUrl;
          return;
        }
        toast({
          variant: "destructive",
          title: "Could not start setup",
          description: "Missing redirect URL.",
        });
        return;
      }
      const errMsg = result.error ?? "Please try again.";
      console.error("[ConnectBankAccount] createConnectAccount failed:", errMsg);
      const isMissingColumn = /column .* does not exist/i.test(errMsg);
      const isConnectNotEnabled = /signed up for Connect|connect.*dashboard\.stripe\.com/i.test(errMsg);
      toast({
        variant: "destructive",
        title: "Could not start setup",
        description: isMissingColumn
          ? "The database is missing a column required for payouts. Run the migration in Supabase (SQL Editor): see supabase/migrations/20250608000000_profiles_stripe_connect_id_ensure.sql"
          : isConnectNotEnabled
            ? "Stripe Connect is not enabled for your Stripe account. Enable it in the Stripe Dashboard, then try again."
            : errMsg,
      });
      if (isConnectNotEnabled) {
        console.info("Enable Connect: https://dashboard.stripe.com/connect/accounts/overview");
      }
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
  };

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
                onClick={handleConnect}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update details"
                )}
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
            onClick={handleConnect}
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
