"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fulfillListerSetupFromSession } from "@/app/settings/actions";
import { useToast } from "@/components/ui/use-toast";

/** When user returns from Stripe Checkout (setup), fulfill the session and save payment method so it works without webhook (e.g. local dev). */
export function SettingsPaymentReturnHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const fulfilledRef = useRef<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const payments = searchParams.get("payments");

    if (payments !== "success" || !sessionId || sessionId === fulfilledRef.current) return;
    fulfilledRef.current = sessionId;

    (async () => {
      const result = await fulfillListerSetupFromSession(sessionId);
      if (result.ok) {
        toast({ title: "Payment method saved", description: "Your card is now connected for Pay & Start Job." });
      } else {
        toast({ variant: "destructive", title: "Could not save payment method", description: result.error });
      }
      router.replace("/profile", { scroll: false });
      router.refresh();
    })();
  }, [searchParams, router, toast]);

  return null;
}
