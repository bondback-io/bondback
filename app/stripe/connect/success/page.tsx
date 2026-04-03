"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { handleConnectSuccess } from "@/lib/actions/stripe-connect";
import { useToast } from "@/components/ui/use-toast";
import { scheduleRouterAction } from "@/lib/deferred-router";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  STRIPE_POPUP_MESSAGE_CONNECT,
  type StripePopupConnectMessage,
} from "@/lib/stripe-popup-messaging";

function StripeConnectSuccessInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        scheduleRouterAction(() => router.replace("/login"));
        return;
      }

      const result = await handleConnectSuccess(session.user.id);
      if (cancelled) return;

      const popup = searchParams.get("popup") === "1";

      if (result.ok) {
        setStatus("done");
        toast({
          title: "Bank account connected successfully!",
          description: "You can now receive payouts when listers release payment.",
        });

        if (popup && typeof window !== "undefined" && window.opener) {
          const msg: StripePopupConnectMessage = {
            type: STRIPE_POPUP_MESSAGE_CONNECT,
            ok: true,
          };
          try {
            window.opener.postMessage(msg, window.location.origin);
          } catch {
            /* ignore */
          }
          window.close();
          return;
        }

        scheduleRouterAction(() => router.replace("/cleaner/dashboard"));
      } else {
        setStatus("error");
        toast({
          variant: "destructive",
          title: "Something went wrong",
          description: result.error,
        });
        if (popup && typeof window !== "undefined" && window.opener) {
          const msg: StripePopupConnectMessage = {
            type: STRIPE_POPUP_MESSAGE_CONNECT,
            ok: false,
            error: result.error,
          };
          try {
            window.opener.postMessage(msg, window.location.origin);
          } catch {
            /* ignore */
          }
          window.close();
          return;
        }
        scheduleRouterAction(() => router.replace("/profile"));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, toast, searchParams]);

  return (
    <section className="page-inner flex min-h-[50vh] flex-col items-center justify-center">
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Completing setup…
          </p>
        </div>
      )}
      {status === "done" && (
        <div className="flex flex-col items-center gap-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="text-sm font-medium text-foreground dark:text-gray-100">
            Bank account connected! Redirecting…
          </p>
        </div>
      )}
      {status === "error" && (
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Redirecting to profile…
        </p>
      )}
    </section>
  );
}

export default function StripeConnectSuccessPage() {
  return (
    <Suspense
      fallback={
        <section className="page-inner flex min-h-[50vh] flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden />
        </section>
      }
    >
      <StripeConnectSuccessInner />
    </Suspense>
  );
}
