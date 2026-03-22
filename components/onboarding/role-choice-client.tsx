"use client";

/**
 * ============================================================================
 * ROLE CHOICE — POST-SIGNUP (auth required; middleware + server page enforce)
 * ============================================================================
 *
 * ONBOARDING FLOW DIAGRAM
 * -----------------------
 *   /signup (email, password, name, postcode)
 *        │
 *        ▼
 *   /onboarding/role-choice   ◄── you are here
 *        │
 *        ├──► saveRoleChoice("lister")
 *        │         ▼
 *        │    /onboarding/lister/quick-setup ──► /lister/dashboard (or /listings/new)
 *        │
 *        └──► saveRoleChoice("cleaner")
 *                  ▼
 *             /onboarding/cleaner/quick-setup ──► /cleaner/dashboard
 *
 * Dual-role backend: `profiles.roles[]` + `active_role` updated in saveRoleChoice.
 * Legacy "both" remains available via API / older routes — this UI is two paths only.
 * ============================================================================
 *
 * ROLE CHOICE — KEY JSX STRUCTURE
 * -------------------------------
 * - Full-viewport-friendly stack: title → two large Cards (House vs Brush)
 * - Pros/cons bullet lines under each card
 * - Primary actions: "Start as Lister" | "Start as Cleaner" (Button size="lg", full width on mobile)
 */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, Brush } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { saveRoleChoice, upsertMinimalProfileAfterSignup } from "@/lib/actions/onboarding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PENDING_PROFILE_KEY = "bondback_pending_minimal_profile";

export function RoleChoiceClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) setSyncing(false);
        return;
      }

      let raw: string | null = null;
      try {
        raw = localStorage.getItem(PENDING_PROFILE_KEY);
      } catch {
        if (!cancelled) setSyncing(false);
        return;
      }

      if (raw) {
        try {
          const payload = JSON.parse(raw) as {
            full_name?: string;
            postcode?: string | null;
            referralCode?: string | null;
          };
          if (payload?.full_name?.trim()) {
            await upsertMinimalProfileAfterSignup({
              full_name: payload.full_name,
              postcode: payload.postcode ?? null,
              referralCode: payload.referralCode ?? null,
            });
            try {
              localStorage.removeItem(PENDING_PROFILE_KEY);
            } catch {
              /* ignore */
            }
          }
        } catch {
          try {
            localStorage.removeItem(PENDING_PROFILE_KEY);
          } catch {
            /* ignore */
          }
        }
      }

      if (!cancelled) setSyncing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChoice = (choice: "lister" | "cleaner") => {
    setError(null);
    startTransition(async () => {
      const result = await saveRoleChoice(choice);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.redirect);
    });
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col justify-center gap-6 px-3 py-8 sm:max-w-2xl md:max-w-4xl md:py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          How do you want to use Bond Back?
        </h1>
        <p className="text-pretty text-base text-muted-foreground sm:text-lg">
          Pick one to start — you can unlock the other role anytime in Settings.
        </p>
      </div>

      {syncing && (
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          Preparing your profile…
        </p>
      )}

      {error && (
        <div
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 md:gap-8">
        {/* Lister path */}
        <Card className="flex flex-col border-2 border-transparent shadow-md transition-colors dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
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
              disabled={isPending || syncing}
              onClick={() => handleChoice("lister")}
            >
              Start as Lister
            </Button>
          </CardContent>
        </Card>

        {/* Cleaner path */}
        <Card className="flex flex-col border-2 border-transparent shadow-md transition-colors dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
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
                <span className="font-medium text-emerald-700 dark:text-emerald-400">+</span> Build reviews &amp; repeat
                clients
              </li>
              <li>
                <span className="font-medium text-amber-700 dark:text-amber-400">−</span> Travel &amp; equipment are on
                you
              </li>
            </ul>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="w-full min-h-14 shrink-0 border border-emerald-600/30 bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-600/90 dark:border-emerald-500/30 sm:min-h-12"
              disabled={isPending || syncing}
              onClick={() => handleChoice("cleaner")}
            >
              Start as Cleaner
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
  );
}
