"use client";

import { useState } from "react";
import { createListerSetupSession } from "@/app/settings/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export type ConnectPaymentMethodProps = {
  userId: string;
  stripePaymentMethodId: string | null;
  isLister: boolean;
};

export function ConnectPaymentMethod({
  userId,
  stripePaymentMethodId,
  isLister,
}: ConnectPaymentMethodProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!isLister) return null;

  const isTestMode =
    typeof process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY === "string" &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith("pk_test");

  const handleConnect = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const result = await createListerSetupSession();
      if (!result) {
        toast({
          variant: "destructive",
          title: "Could not start setup",
          description: "No response. Please try again.",
        });
        return;
      }
      if (result.ok && "url" in result && result.url) {
        window.location.href = result.url;
        return;
      }
      toast({
        variant: "destructive",
        title: "Could not start setup",
        description: result.ok === false ? result.error : "Missing redirect URL.",
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
  };

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
        {stripePaymentMethodId ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>Payment method connected. You can use Pay &amp; Start Job without leaving the page.</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-2"
              disabled={loading}
              onClick={handleConnect}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update card"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleConnect}
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
