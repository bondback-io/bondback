"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Brush, Home, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markPostLoginFullPageNavigation } from "@/lib/auth/post-login-navigation-flag";
import { completeGoogleSignupProfile } from "@/lib/actions/complete-google-signup-profile";
import { useAbnLiveValidation } from "@/hooks/use-abn-live-validation";
import { cn } from "@/lib/utils";

const EASE = [0.25, 0.1, 0.25, 1] as const;
const btnTouch =
  "touch-manipulation min-h-[3.25rem] w-full shrink-0 text-base font-semibold transition-transform duration-150 active:scale-[0.98] sm:min-h-12";

type Phase = "role" | "cleaner-abn";

export function GoogleSignupCompleteClient() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("role");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const [abnInput, setAbnInput] = useState("");
  const abnLive = useAbnLiveValidation(abnInput);

  useEffect(() => {
    markPostLoginFullPageNavigation();
  }, []);

  const flowDur = reduceMotion ? 0 : 0.28;

  const runComplete = useCallback(
    async (payload: { role: "lister" | "cleaner"; abn: string | null; skipAbn?: boolean }) => {
      setError(null);
      startTransition(() => setSubmitting(true));
      try {
        const result = await completeGoogleSignupProfile(payload);
        if (!result.ok) {
          if (result.error.includes("already set")) {
            router.replace("/dashboard");
            return;
          }
          setError(result.error);
          return;
        }
        router.replace(result.redirect);
      } finally {
        setSubmitting(false);
      }
    },
    [router, startTransition]
  );

  const onLister = useCallback(() => {
    void runComplete({ role: "lister", abn: null });
  }, [runComplete]);

  const onCleanerChosen = useCallback(() => {
    setError(null);
    setPhase("cleaner-abn");
  }, []);

  const onCleanerSubmit = useCallback(() => {
    const digits = abnInput.replace(/\D/g, "");
    if (digits.length !== 11) {
      setError("Enter an 11-digit ABN or skip for now.");
      return;
    }
    if (abnLive.status === "invalid") {
      setError(abnLive.error ?? "ABN could not be verified.");
      return;
    }
    if (abnLive.validating) {
      setError("Still checking your ABN — try again in a moment.");
      return;
    }
    void runComplete({ role: "cleaner", abn: digits });
  }, [abnInput, abnLive.error, abnLive.status, abnLive.validating, runComplete]);

  const onSkipAbn = useCallback(() => {
    void runComplete({ role: "cleaner", abn: null, skipAbn: true });
  }, [runComplete]);

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] w-full flex-col items-center justify-center px-3 py-8">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: flowDur, ease: EASE }}
        className="w-full max-w-lg space-y-6 sm:max-w-2xl"
      >
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Almost there</p>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Complete your profile
          </h1>
          <p className="text-pretty text-sm text-muted-foreground sm:text-base">
            You signed in with Google. Choose how you&apos;ll use Bond Back — we&apos;ll take you to the right
            dashboard.
          </p>
        </div>

        {error && (
          <div
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {phase === "role" ? (
            <motion.div
              key="roles"
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
              transition={{ duration: flowDur, ease: EASE }}
              className="grid gap-5 md:grid-cols-2 md:gap-6"
            >
              <Card
                className={cn(
                  "flex flex-col border-2 shadow-md transition-colors dark:border-gray-800 dark:bg-gray-900",
                  "border-sky-500/20 hover:border-sky-500/50"
                )}
              >
                <CardHeader className="space-y-3 pb-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-900/50">
                    <Home className="h-8 w-8 text-sky-600 dark:text-sky-300" aria-hidden />
                  </div>
                  <CardTitle className="text-lg font-bold sm:text-xl">Lister</CardTitle>
                  <CardDescription className="text-sm">
                    Post bond cleans, compare bids, and hire cleaners.
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  <Button
                    type="button"
                    size="lg"
                    className={cn(btnTouch, "bg-sky-600 hover:bg-sky-600/90")}
                    disabled={submitting}
                    onClick={onLister}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Start as Lister"
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  "flex flex-col border-2 shadow-md transition-colors dark:border-gray-800 dark:bg-gray-900",
                  "border-emerald-500/20 hover:border-emerald-500/50"
                )}
              >
                <CardHeader className="space-y-3 pb-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40">
                    <Brush className="h-8 w-8 text-emerald-700 dark:text-emerald-300" aria-hidden />
                  </div>
                  <CardTitle className="text-lg font-bold sm:text-xl">Cleaner</CardTitle>
                  <CardDescription className="text-sm">
                    Find jobs, bid, and get paid for bond cleaning work.
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  <Button
                    type="button"
                    size="lg"
                    variant="secondary"
                    className={cn(
                      btnTouch,
                      "border border-emerald-600/40 bg-emerald-600 text-white hover:bg-emerald-600/92"
                    )}
                    disabled={submitting}
                    onClick={onCleanerChosen}
                  >
                    Start as Cleaner
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="abn"
              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
              transition={{ duration: flowDur, ease: EASE }}
            >
              <Card className="border-2 border-emerald-500/25 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                <CardHeader>
                  <CardTitle className="text-xl">Cleaner — ABN</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    ABN is required for Cleaner accounts to verify you&apos;re a professional cleaner. We check it
                    against the Australian Business Register when validation is enabled.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="g-abn" className="text-base">
                      Australian Business Number (ABN)
                    </Label>
                    <Input
                      id="g-abn"
                      inputMode="numeric"
                      autoComplete="off"
                      className="min-h-12 text-base"
                      placeholder="11 digits"
                      value={abnInput}
                      onChange={(e) => setAbnInput(e.target.value)}
                      disabled={submitting}
                    />
                    {abnLive.validating && (
                      <p className="text-xs text-muted-foreground">Checking ABN…</p>
                    )}
                    {abnLive.status === "valid" && (
                      <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        {abnLive.entityName ? `Verified — ${abnLive.entityName}` : "ABN looks good."}
                      </p>
                    )}
                    {abnLive.status === "invalid" && abnInput.replace(/\D/g, "").length === 11 && (
                      <p className="text-xs text-destructive">{abnLive.error}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      className="order-2 text-muted-foreground sm:order-1"
                      disabled={submitting}
                      onClick={() => {
                        setPhase("role");
                        setAbnInput("");
                        setError(null);
                      }}
                    >
                      Back
                    </Button>
                    <div className="order-1 flex w-full flex-col gap-2 sm:order-2 sm:w-auto sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 w-full sm:w-auto"
                        disabled={submitting}
                        onClick={onSkipAbn}
                      >
                        Skip for now
                      </Button>
                      <Button
                        type="button"
                        className="min-h-11 w-full sm:min-w-[10rem]"
                        disabled={submitting || abnLive.validating}
                        onClick={onCleanerSubmit}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          "Continue"
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    You can add or update your ABN anytime in{" "}
                    <Link href="/settings" className="font-medium text-primary underline underline-offset-2">
                      Settings
                    </Link>
                    .
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
