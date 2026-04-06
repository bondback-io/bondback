"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Brush, Home, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { markPostLoginFullPageNavigation } from "@/lib/auth/post-login-navigation-flag";
import { completeGoogleSignupProfile } from "@/lib/actions/complete-google-signup-profile";
import { AbnCleanerOnboardingField } from "@/components/onboarding/abn-cleaner-onboarding-field";
import { cn } from "@/lib/utils";

const EASE = [0.25, 0.1, 0.25, 1] as const;
const btnTouch =
  "touch-manipulation min-h-[3.25rem] w-full shrink-0 text-base font-semibold transition-transform duration-150 active:scale-[0.98] sm:min-h-12";

type Phase = "role" | "lister-confirm" | "cleaner-abn";

export function GoogleSignupCompleteClient() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("role");
  const [error, setError] = useState<string | null>(null);
  /** Cleaner ABN step: validation + server errors shown under the field */
  const [abnError, setAbnError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const [abnInput, setAbnInput] = useState("");
  const [abnCanSubmit, setAbnCanSubmit] = useState(false);

  useEffect(() => {
    markPostLoginFullPageNavigation();
  }, []);

  const flowDur = reduceMotion ? 0 : 0.28;

  const runComplete = useCallback(
    async (payload: { role: "lister" | "cleaner"; abn: string | null }) => {
      setError(null);
      setAbnError(null);
      startTransition(() => setSubmitting(true));
      try {
        const result = await completeGoogleSignupProfile(payload);
        if (!result.ok) {
          if (result.error.includes("already set")) {
            router.replace("/dashboard");
            return;
          }
          if (payload.role === "cleaner") {
            setAbnError(result.error);
          } else {
            setError(result.error);
          }
          return;
        }
        router.replace(result.redirect);
      } finally {
        setSubmitting(false);
      }
    },
    [router, startTransition]
  );

  const onListerChosen = useCallback(() => {
    setError(null);
    setPhase("lister-confirm");
  }, []);

  const onListerConfirmSubmit = useCallback(() => {
    void runComplete({ role: "lister", abn: null });
  }, [runComplete]);

  const onCleanerChosen = useCallback(() => {
    setError(null);
    setAbnError(null);
    setAbnInput("");
    setAbnCanSubmit(false);
    setPhase("cleaner-abn");
  }, []);

  const onCleanerSubmit = useCallback(() => {
    setAbnError(null);
    setError(null);
    const digits = abnInput.replace(/\D/g, "").slice(0, 11);
    if (!abnCanSubmit) {
      setAbnError(
        digits.length !== 11
          ? "Enter all 11 digits of your ABN."
          : "ABN could not be verified. Check the number and try again."
      );
      return;
    }
    void runComplete({ role: "cleaner", abn: digits });
  }, [abnCanSubmit, abnInput, runComplete]);

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

        {(phase === "role" || phase === "lister-confirm") && error && (
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
                    onClick={onListerChosen}
                  >
                    Start as Lister
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
          ) : phase === "lister-confirm" ? (
            <motion.div
              key="lister-confirm"
              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
              transition={{ duration: flowDur, ease: EASE }}
            >
              <Card className="border-2 border-sky-500/25 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-900/50">
                    <Home className="h-7 w-7 text-sky-600 dark:text-sky-300" aria-hidden />
                  </div>
                  <CardTitle className="text-xl pt-2">Lister</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    You&apos;ll post bond cleans, compare bids from cleaners, and hire the right person for the
                    job. Confirm to finish setup and open your dashboard.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      className="order-2 w-full sm:order-1 sm:w-auto"
                      disabled={submitting}
                      onClick={() => {
                        setPhase("role");
                        setError(null);
                      }}
                    >
                      Back to role choice
                    </Button>
                    <Button
                      type="button"
                      className={cn(
                        "order-1 min-h-11 w-full sm:order-2 sm:min-w-[10rem]",
                        "bg-sky-600 hover:bg-sky-600/90"
                      )}
                      disabled={submitting}
                      onClick={onListerConfirmSubmit}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Continue as Lister"
                      )}
                    </Button>
                  </div>
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
                    ABN is required for Cleaner accounts. Enter your 11-digit number — we validate it live
                    against the Australian Business Register when ABR checks are enabled.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AbnCleanerOnboardingField
                    id="g-abn"
                    value={abnInput}
                    onChange={(d) => {
                      setAbnError(null);
                      setAbnInput(d);
                    }}
                    disabled={submitting}
                    primaryError={abnError}
                    onReadyChange={setAbnCanSubmit}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      className="order-2 w-full sm:order-1 sm:w-auto"
                      disabled={submitting}
                      onClick={() => {
                        setPhase("role");
                        setAbnInput("");
                        setAbnCanSubmit(false);
                        setAbnError(null);
                        setError(null);
                      }}
                    >
                      Back to role choice
                    </Button>
                    <Button
                      type="button"
                      className="order-1 min-h-11 w-full sm:order-2 sm:min-w-[10rem]"
                      disabled={submitting || !abnCanSubmit}
                      onClick={onCleanerSubmit}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Continue as Cleaner"
                      )}
                    </Button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    You can update your ABN later in{" "}
                    <Link href="/settings" className="font-medium text-primary underline underline-offset-2">
                      Settings
                    </Link>{" "}
                    if your business details change.
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
