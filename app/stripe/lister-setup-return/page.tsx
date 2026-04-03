"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fulfillListerSetupFromSession } from "@/app/settings/actions";
import {
  STRIPE_POPUP_MESSAGE_LISTER_SETUP,
  type StripePopupListerSetupMessage,
} from "@/lib/stripe-popup-messaging";
import { Loader2 } from "lucide-react";

/** Dev Strict Mode runs effects twice; avoid duplicate fulfillment / postMessage. */
const processedListerSetupKeys = new Set<string>();

function postToOpener(msg: StripePopupListerSetupMessage) {
  try {
    if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
      window.opener.postMessage(msg, window.location.origin);
    }
  } catch {
    /* ignore */
  }
  window.close();
}

function ListerSetupReturnInner() {
  const searchParams = useSearchParams();
  const [label, setLabel] = useState("Saving your card…");

  useEffect(() => {
    if (searchParams.get("cancelled") === "1") {
      const key = "lister_setup:cancelled";
      if (processedListerSetupKeys.has(key)) return;
      processedListerSetupKeys.add(key);
      postToOpener({
        type: STRIPE_POPUP_MESSAGE_LISTER_SETUP,
        ok: false,
        cancelled: true,
      });
      return;
    }

    const sessionId = searchParams.get("session_id")?.trim() ?? "";
    if (!sessionId) {
      const key = "lister_setup:missing_session";
      if (processedListerSetupKeys.has(key)) return;
      processedListerSetupKeys.add(key);
      postToOpener({
        type: STRIPE_POPUP_MESSAGE_LISTER_SETUP,
        ok: false,
        error: "Missing session.",
      });
      return;
    }

    if (processedListerSetupKeys.has(sessionId)) return;
    processedListerSetupKeys.add(sessionId);

    void (async () => {
      const result = await fulfillListerSetupFromSession(sessionId);
      if (result.ok) {
        setLabel("Done!");
        postToOpener({ type: STRIPE_POPUP_MESSAGE_LISTER_SETUP, ok: true });
      } else {
        postToOpener({
          type: STRIPE_POPUP_MESSAGE_LISTER_SETUP,
          ok: false,
          error: result.error,
        });
      }
    })();
  }, [searchParams]);

  return (
    <section className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-sky-600 dark:text-sky-400" aria-hidden />
      <p className="text-sm text-muted-foreground dark:text-gray-400">{label}</p>
      <p className="text-xs text-muted-foreground dark:text-gray-500">
        This window should close automatically. You can close it if it stays open.
      </p>
    </section>
  );
}

export default function ListerSetupReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ListerSetupReturnInner />
    </Suspense>
  );
}
