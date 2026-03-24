"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { handleConnectSuccess } from "@/lib/actions/stripe-connect";
import { useToast } from "@/components/ui/use-toast";
import { scheduleRouterAction } from "@/lib/deferred-router";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function StripeConnectSuccessPage() {
  const router = useRouter();
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

      if (result.ok) {
        setStatus("done");
        toast({
          title: "Bank account connected successfully!",
          description: "You can now receive payouts when listers release payment.",
        });
        scheduleRouterAction(() => router.replace("/cleaner/dashboard"));
      } else {
        setStatus("error");
        toast({
          variant: "destructive",
          title: "Something went wrong",
          description: result.error,
        });
        scheduleRouterAction(() => router.replace("/profile"));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, toast]);

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
