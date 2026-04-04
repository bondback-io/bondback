"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthEmailConfirmTransitionLoader } from "@/components/onboarding/auth-email-confirm-transition-loader";
import { Button } from "@/components/ui/button";

/** Prevents duplicate POST in React Strict Mode (double mount) for the same query string. */
let activeConfirmQuery: string | null = null;

/**
 * Runs confirmation via POST /api/auth/confirm so the user sees a loading UI immediately.
 */
export function AuthConfirmClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = React.useState<"confirming" | "redirecting" | "error">("confirming");
  const [errorHint, setErrorHint] = React.useState<string | null>(null);

  React.useEffect(() => {
    const qs = searchParams.toString();
    if (!qs) {
      router.replace(
        "/auth/confirm/error?reason=missing_token&message=" +
          encodeURIComponent(
            "This page needs the full link from your confirmation email. Open the email and tap the button again, or request a new link below."
          )
      );
      return;
    }

    if (activeConfirmQuery === qs) {
      return;
    }
    activeConfirmQuery = qs;

    void (async () => {
      try {
        const r = await fetch("/api/auth/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ search: `?${qs}` }),
          redirect: "manual",
        });

        if (r.status === 302 || r.status === 303 || r.status === 307) {
          const loc = r.headers.get("Location");
          if (loc) {
            setPhase("redirecting");
            const absolute = new URL(loc, window.location.origin).href;
            window.location.replace(absolute);
            return;
          }
        }

        setPhase("error");
        setErrorHint(
          "We couldn’t complete confirmation in this tab. Open the link in Safari or Chrome (not the Mail preview), or use the help options below."
        );
      } catch {
        setPhase("error");
        setErrorHint(
          "Network error — check your connection, then try again or open the link in Safari or Chrome."
        );
      } finally {
        if (activeConfirmQuery === qs) {
          activeConfirmQuery = null;
        }
      }
    })();
  }, [router, searchParams]);

  if (phase === "error") {
    return (
      <section className="page-inner flex min-h-[70vh] flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border/70 bg-card p-6 text-center shadow-lg">
          <p className="text-lg font-semibold text-foreground">Couldn’t finish confirmation</p>
          <p className="text-sm text-muted-foreground">{errorHint}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/auth/confirm/error">Get help &amp; resend email</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/signup">Back to sign up</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <AuthEmailConfirmTransitionLoader
      variant="full"
      mode="linkConfirm"
      phaseLabel={phase === "redirecting" ? "Taking you to your account…" : undefined}
    />
  );
}
