"use client";

/**
 * ROLE CHOICE — Post-signup. When the server already validated session + profile (`serverSessionReady`),
 * the UI renders immediately (no client polling). Otherwise one `onAuthStateChange` + initial `getSession`.
 */

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { markPostLoginFullPageNavigation } from "@/lib/auth/post-login-navigation-flag";
import { isAuthPerfDev } from "@/lib/auth/auth-perf-dev";
import { saveRoleChoice, upsertMinimalProfileAfterSignup } from "@/lib/actions/onboarding";
import { PENDING_MINIMAL_PROFILE_KEY } from "@/components/onboarding/onboarding-storage";
import { OnboardingFlowProgressScreen } from "@/components/onboarding/onboarding-flow-progress-screen";
import { RoleChoiceGrid, type RoleChoiceGridProps } from "@/components/onboarding/role-choice-grid";

export type RoleChoiceClientProps = {
  /** True when the RSC already ran `getSession` + profile — skip waiting on browser Supabase. */
  serverSessionReady: boolean;
};

function RoleChoiceClientInner({ serverSessionReady }: RoleChoiceClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const mountedAtRef = useRef<number | null>(null);
  if (mountedAtRef.current === null) {
    mountedAtRef.current = Date.now();
  }
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(serverSessionReady);
  const [savingChoice, setSavingChoice] = useState<"lister" | "cleaner" | null>(null);
  const [optimisticChoice, setOptimisticChoice] = useState<"lister" | "cleaner" | null>(null);
  const [roleTransition, setRoleTransition] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);

  useEffect(() => {
    /** Skip SessionSync’s debounced `router.refresh()` right after email-confirm full navigation (saves layout+RSC churn). */
    markPostLoginFullPageNavigation();
  }, []);

  /** Same paint as server HTML — avoids one frame of loader when RSC already validated session. */
  useLayoutEffect(() => {
    if (serverSessionReady) {
      setAuthReady(true);
    }
  }, [serverSessionReady]);

  useEffect(() => {
    const loginPath = "/login?next=/onboarding/role-choice";

    if (serverSessionReady) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          router.replace(loginPath);
        }
      });
      return () => subscription.unsubscribe();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        startTransition(() => setAuthReady(true));
      }
      if (event === "SIGNED_OUT" || !session) {
        router.replace(loginPath);
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        startTransition(() => setAuthReady(true));
      }
    });

    return () => subscription.unsubscribe();
  }, [serverSessionReady, supabase, router]);

  useEffect(() => {
    if (!authReady || !isAuthPerfDev || mountedAtRef.current === null) return;
    console.info("[auth:perf] role-choice:authReady → role UI", {
      msSinceClientMount: Date.now() - mountedAtRef.current,
      serverSessionReady,
    });
  }, [authReady, serverSessionReady]);

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;
    const run = () => {
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
    };

    const t = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [authReady]);

  const handleChoice: RoleChoiceGridProps["onChoice"] = useCallback((choice) => {
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
        startTransition(() => {
          setRoleTransition({
            title:
              choice === "cleaner" ? "Taking you to cleaner setup…" : "Taking you to lister setup…",
            subtitle: "Hang tight — opening the next step.",
          });
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
  }, []);

  const showRoleUi = authReady && !roleTransition;

  return (
    <>
      <OnboardingFlowProgressScreen authReady={authReady} roleTransition={roleTransition} />

      {showRoleUi && (
        <RoleChoiceGrid
          error={error}
          savingChoice={savingChoice}
          optimisticChoice={optimisticChoice}
          onChoice={handleChoice}
        />
      )}
    </>
  );
}

export const RoleChoiceClient = memo(RoleChoiceClientInner);
