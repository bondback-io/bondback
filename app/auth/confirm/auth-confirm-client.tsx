"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  AccountCreationProgressModal,
  type AccountCreationStep,
} from "@/components/auth/account-creation-progress-modal";

const EMAIL_CONFIRM_STEPS: readonly AccountCreationStep[] = [
  { id: "verify", label: "Verifying your email link…" },
  { id: "session", label: "Signing you in securely…" },
  { id: "onboard", label: "Taking you to onboarding…" },
];

function activeStepFromProgress(progress: number): string {
  if (progress < 38) return "verify";
  if (progress < 72) return "session";
  return "onboard";
}

export function AuthConfirmClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const [phase, setPhase] = useState<"running" | "error">("running");
  const [progress, setProgress] = useState(14);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const activeStepId = activeStepFromProgress(progress);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      setProgress((p) => Math.min(90, p + 5));
    }, 550);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setPhase("running");
      setErrorMessage(null);
      setProgress(14);

      if (!qs) {
        router.replace(
          `/auth/confirm/error?reason=missing_token&message=${encodeURIComponent(
            "This confirmation link is missing a token. Open the latest email from Bond Back."
          )}`
        );
        return;
      }

      const sp = new URLSearchParams(qs);
      const errorParam = sp.get("error") ?? sp.get("error_code");
      if (errorParam) {
        const msg =
          sp.get("error_description")?.replace(/\+/g, " ") ||
          "Email confirmation was cancelled or could not be completed.";
        router.replace(`/auth/confirm/error?reason=oauth_error&message=${encodeURIComponent(msg)}`);
        return;
      }

      const hasCode = Boolean(sp.get("code")?.trim());
      const hasToken = Boolean(sp.get("token_hash")?.trim() || sp.get("token")?.trim());
      if (!hasCode && !hasToken) {
        router.replace(
          `/auth/confirm/error?reason=missing_token&message=${encodeURIComponent(
            "This confirmation link is missing a token. Request a new confirmation email from the sign-up page."
          )}`
        );
        return;
      }

      try {
        const res = await fetch(`/api/auth/confirm?${qs}`, {
          method: "GET",
          credentials: "include",
          redirect: "manual",
          cache: "no-store",
        });

        if (cancelled) return;

        if (res.type === "opaqueredirect") {
          window.location.href = `/api/auth/confirm?${qs}`;
          return;
        }

        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("Location");
          if (loc) {
            window.location.assign(new URL(loc, window.location.origin).href);
            return;
          }
        }

        if (res.ok) {
          window.location.reload();
          return;
        }

        const text = await res.text().catch(() => "");
        if (cancelled) return;
        setPhase("error");
        setErrorMessage(
          text.replace(/<[^>]+>/g, " ").trim().slice(0, 280) ||
            `Could not confirm your email (HTTP ${res.status}). Try the link again or log in.`
        );
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setErrorMessage(e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [attempt, qs, router]);

  const handleRetry = () => {
    setAttempt((a) => a + 1);
  };

  return (
    <AccountCreationProgressModal
      open
      onOpenChange={() => {}}
      phase={phase === "running" ? "running" : "error"}
      progress={progress}
      steps={EMAIL_CONFIRM_STEPS}
      activeStepId={activeStepId}
      titleRunning="Confirming your email…"
      subtitleRunning="Please wait while we verify your link and set up your session — this usually takes a few seconds."
      errorMessage={errorMessage}
      failureHint="If it keeps failing, open the link again or log in with your email and password."
      onRetry={phase === "error" ? handleRetry : undefined}
    />
  );
}

export function AuthConfirmFallback() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-sky-50/95 via-background to-background p-6 dark:from-sky-950/90 dark:via-gray-950 dark:to-gray-950"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-10 w-10 animate-spin text-sky-600 dark:text-sky-400" aria-hidden />
      <div className="max-w-sm text-center">
        <p className="text-base font-semibold text-sky-950 dark:text-sky-50">Preparing confirmation…</p>
        <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">One moment.</p>
      </div>
    </div>
  );
}
