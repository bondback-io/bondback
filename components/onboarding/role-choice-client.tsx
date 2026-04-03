"use client";

/**
 * ROLE CHOICE — Post-signup. Session may lag the server after `/auth/confirm`; we resolve via
 * `onAuthStateChange` + `getSession` + deferred `router.refresh()` + short polling.
 * Role → next step uses full-page navigation (`location.assign`) so the overlay never clears
 * before the next document loads (avoids flicker back to this screen).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brush, Home } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { saveRoleChoice, upsertMinimalProfileAfterSignup } from "@/lib/actions/onboarding";
import { PENDING_MINIMAL_PROFILE_KEY } from "@/components/onboarding/onboarding-storage";
import { OnboardingFlowProgressScreen } from "@/components/onboarding/onboarding-flow-progress-screen";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RoleChoiceClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [savingChoice, setSavingChoice] = useState<"lister" | "cleaner" | null>(null);
  const [optimisticChoice, setOptimisticChoice] = useState<"lister" | "cleaner" | null>(null);
  const [roleTransition, setRoleTransition] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);

  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    const markReady = () => {
      if (cancelled || readyRef.current) return;
      readyRef.current = true;
      setAuthReady(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) markReady();
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) markReady();
    });

    const refreshTimer = window.setTimeout(() => {
      if (!cancelled && !readyRef.current) {
        router.refresh();
      }
    }, 400);

    let pollCount = 0;
    const pollId = window.setInterval(() => {
      if (cancelled || readyRef.current) return;
      pollCount += 1;
      if (pollCount > 40) {
        window.clearInterval(pollId);
        return;
      }
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) markReady();
      });
    }, 120);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(refreshTimer);
      window.clearInterval(pollId);
    };
  }, [router]);

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;
    void (async () => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(PENDING_MINIMAL_PROFILE_KEY);
      } catch {
        return;
      }
      if (!raw || cancelled) return;

      try {
        const payload = JSON.parse(raw) as {
          full_name?: string;
          suburb?: string | null;
          postcode?: string | null;
          referralCode?: string | null;
        };
        if (payload?.full_name?.trim()) {
          await upsertMinimalProfileAfterSignup({
            full_name: payload.full_name,
            suburb: payload.suburb ?? null,
            postcode: payload.postcode ?? null,
            referralCode: payload.referralCode ?? null,
          });
          try {
            localStorage.removeItem(PENDING_MINIMAL_PROFILE_KEY);
          } catch {
            /* ignore */
          }
        }
      } catch {
        try {
          localStorage.removeItem(PENDING_MINIMAL_PROFILE_KEY);
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady]);

  const handleChoice = (choice: "lister" | "cleaner") => {
    setError(null);
    setOptimisticChoice(choice);
    setSavingChoice(choice);
    void (async () => {
      try {
        const result = await saveRoleChoice(choice);
        if (!result.ok) {
          setOptimisticChoice(null);
          setError(result.error);
          setSavingChoice(null);
          return;
        }
        setRoleTransition({
          title:
            choice === "cleaner"
              ? "Taking you to cleaner setup…"
              : "Taking you to lister setup…",
          subtitle: "Hang tight — opening the next step.",
        });
        requestAnimationFrame(() => {
          window.location.assign(result.redirect);
        });
      } catch (e) {
        setOptimisticChoice(null);
        setSavingChoice(null);
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    })();
  };

  return (
    <>
      <OnboardingFlowProgressScreen authReady={authReady} roleTransition={roleTransition} />

      {authReady && !roleTransition && (
        <div className="relative flex min-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col justify-center gap-6 px-3 py-8 sm:max-w-2xl md:max-w-4xl md:py-12">
          <div className="space-y-2 text-center">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How do you want to use Bond Back?
            </h1>
            <p className="text-pretty text-base text-muted-foreground sm:text-lg">
              Pick one to start — you can unlock the other role anytime in Settings.
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

          <div className="grid gap-5 md:grid-cols-2 md:gap-8">
            <Card
              className={cn(
                "flex flex-col border-2 shadow-md transition-colors dark:border-gray-800 dark:bg-gray-900 dark:shadow-none",
                optimisticChoice === "lister"
                  ? "border-sky-500/70 ring-2 ring-sky-500/25 dark:border-sky-500/60"
                  : "border-transparent"
              )}
            >
              <CardHeader className="space-y-4 pb-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-900/50">
                  <Home className="h-9 w-9 text-sky-600 dark:text-sky-300" aria-hidden />
                </div>
                <CardTitle className="text-xl font-bold sm:text-2xl">I want to LIST bond cleans</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Post end-of-lease cleans, compare bids, and hire cleaners you trust.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-1 flex-col gap-4 pt-0">
                <ul className="space-y-2 text-sm text-muted-foreground sm:text-base">
                  <li>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">+</span> Earn back your bond with
                    competitive quotes
                  </li>
                  <li>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">+</span> Manage listings &amp;
                    payments in one place
                  </li>
                  <li>
                    <span className="font-medium text-amber-700 dark:text-amber-400">−</span> You coordinate access &amp;
                    property details
                  </li>
                </ul>
                <Button
                  type="button"
                  size="lg"
                  className="w-full min-h-14 shrink-0 text-base font-semibold sm:min-h-12"
                  disabled={savingChoice != null}
                  onClick={() => handleChoice("lister")}
                >
                  {savingChoice === "lister" ? "Starting…" : "Start as Lister"}
                </Button>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "flex flex-col border-2 shadow-md transition-colors dark:border-gray-800 dark:bg-gray-900 dark:shadow-none",
                optimisticChoice === "cleaner"
                  ? "border-emerald-500/70 ring-2 ring-emerald-500/25 dark:border-emerald-500/60"
                  : "border-transparent"
              )}
            >
              <CardHeader className="space-y-4 pb-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40">
                  <Brush className="h-9 w-9 text-emerald-700 dark:text-emerald-300" aria-hidden />
                </div>
                <CardTitle className="text-xl font-bold sm:text-2xl">I want to CLEAN</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Find bond cleans near you, place bids, and get paid for quality work.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-1 flex-col gap-4 pt-0">
                <ul className="space-y-2 text-sm text-muted-foreground sm:text-base">
                  <li>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">+</span> Flexible jobs &amp;
                    transparent bidding
                  </li>
                  <li>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">+</span> Build reviews &amp;
                    repeat clients
                  </li>
                  <li>
                    <span className="font-medium text-amber-700 dark:text-amber-400">−</span> Travel &amp; equipment are
                    on you
                  </li>
                </ul>
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  className="w-full min-h-14 shrink-0 border border-emerald-600/30 bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-600/90 dark:border-emerald-500/30 sm:min-h-12"
                  disabled={savingChoice != null}
                  onClick={() => handleChoice("cleaner")}
                >
                  {savingChoice === "cleaner" ? "Starting…" : "Start as Cleaner"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-base text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary underline underline-offset-2">
              Log in
            </Link>
          </p>
        </div>
      )}
    </>
  );
}
