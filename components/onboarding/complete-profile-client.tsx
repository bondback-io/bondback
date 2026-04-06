"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_INACTIVE_MESSAGE } from "@/lib/auth/account-errors";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  completeOnboardingFromSignup,
  upsertMinimalProfileAfterSignup,
  type OnboardingDetailsInput,
} from "@/lib/actions/onboarding";
import {
  getOnboardingRole,
  getOnboardingDetails,
  clearOnboarding,
  PENDING_MINIMAL_PROFILE_KEY,
} from "./onboarding-storage";

/**
 * After email confirmation:
 * 1) Main `/signup` pending minimal profile → upsert → `/onboarding/role-choice` (same as desktop; mobile-friendly).
 * 2) `/onboarding/*` flow with role+details → `completeOnboardingFromSignup` → `/dashboard`.
 * 3) Otherwise → `/onboarding/role-choice` immediately (no 2s delay).
 */
export function CompleteProfileClient() {
  const router = useRouter();
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // 1) Airtasker-style signup: name/postcode in localStorage (may be missing on mobile in-app browsers)
      try {
        const raw =
          typeof window !== "undefined" ? window.localStorage.getItem(PENDING_MINIMAL_PROFILE_KEY) : null;
        if (raw) {
          const payload = JSON.parse(raw) as {
            full_name?: string;
            suburb?: string | null;
            postcode?: string | null;
            referralCode?: string | null;
          };
          if (payload?.full_name?.trim()) {
            const result = await upsertMinimalProfileAfterSignup({
              full_name: payload.full_name,
              suburb: payload.suburb ?? null,
              postcode: payload.postcode ?? null,
              referralCode: payload.referralCode ?? null,
            });
            if (!cancelled && result.ok) {
              try {
                window.localStorage.removeItem(PENDING_MINIMAL_PROFILE_KEY);
              } catch {
                /* ignore */
              }
              router.replace("/onboarding/role-choice");
              return;
            }
            if (!cancelled && !result.ok) {
              if (result.error === ACCOUNT_INACTIVE_MESSAGE) {
                await createBrowserSupabaseClient().auth.signOut();
                router.replace("/login?message=session_ended");
                return;
              }
              setHint(result.error ?? null);
            }
          }
        }
      } catch {
        try {
          window.localStorage.removeItem(PENDING_MINIMAL_PROFILE_KEY);
        } catch {
          /* ignore */
        }
      }

      const role = getOnboardingRole();
      const details = getOnboardingDetails();
      if (role && details?.full_name?.trim()) {
        const result = await completeOnboardingFromSignup(role, details as OnboardingDetailsInput);
        if (!cancelled && result.ok) {
          clearOnboarding();
          router.replace("/dashboard");
          return;
        }
        if (!cancelled && !result.ok) {
          setHint(result.error ?? null);
        }
      }

      if (!cancelled) {
        router.replace("/onboarding/role-choice");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-md space-y-2 text-center">
      <p className="text-sm text-muted-foreground dark:text-gray-400">
        Completing sign-in…
      </p>
      {hint ? (
        <p className="text-xs text-destructive dark:text-red-300">{hint}</p>
      ) : null}
    </div>
  );
}
