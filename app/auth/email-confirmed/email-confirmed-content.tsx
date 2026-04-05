"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

const COUNTDOWN_SECONDS = 5;

export function EmailConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    return sanitizeInternalNextPath(searchParams.get("next"), "/dashboard");
  }, [searchParams]);

  const destinationHint = useMemo(() => {
    if (nextPath.startsWith("/onboarding")) {
      return "We’re about to send you off to finish setting up your account.";
    }
    return "We’re about to send you to your dashboard.";
  }, [nextPath]);

  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (seconds <= 0) {
      router.replace(nextPath);
      return;
    }
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds, nextPath, router]);

  const goNow = () => {
    router.replace(nextPath);
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-12">
      <Card className="border-border/80 shadow-md dark:border-gray-800 dark:bg-gray-900/80">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            </span>
          </div>
          <CardTitle className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
            You&apos;re in — email confirmed 🇦🇺
          </CardTitle>
          <CardDescription className="text-left text-base leading-relaxed text-muted-foreground dark:text-gray-300">
            Thanks for proving you&apos;re not a robot (or a very clever dog). Your Bond Back account
            is officially <strong className="text-foreground dark:text-gray-100">real</strong> —
            we&apos;ve marked your email as confirmed, and we&apos;re not pulling your leg about the
            bond-clean thing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground dark:text-gray-400">{destinationHint}</p>
          <div className="flex flex-col items-center gap-2">
            <p
              className="text-4xl font-bold tabular-nums text-primary dark:text-sky-400"
              aria-live="polite"
              aria-atomic="true"
            >
              {seconds > 0 ? seconds : 0}
            </p>
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              second{seconds === 1 ? "" : "s"} until we redirect you
            </p>
          </div>
          <Button type="button" className="w-full sm:w-auto" onClick={goNow}>
            Go there now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
