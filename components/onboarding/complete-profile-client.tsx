"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboardingFromSignup, type OnboardingDetailsInput } from "@/lib/actions/onboarding";
import { getOnboardingRole, getOnboardingDetails, clearOnboarding } from "./onboarding-storage";

export function CompleteProfileClient() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "done" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const role = getOnboardingRole();
      const details = getOnboardingDetails();
      if (!role || !details?.full_name?.trim()) {
        if (!cancelled) setStatus("missing");
        return;
      }
      const result = await completeOnboardingFromSignup(role, details as OnboardingDetailsInput);
      if (!cancelled && result.ok) {
        clearOnboarding();
        router.replace("/dashboard");
        return;
      }
      if (!cancelled) setStatus("missing");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (status !== "missing") return;
    const t = setTimeout(() => router.replace("/onboarding/role-choice"), 2000);
    return () => clearTimeout(t);
  }, [status, router]);

  if (status === "missing") {
    return (
      <p className="text-center text-sm text-muted-foreground dark:text-gray-400">
        No onboarding data found. Redirecting to role choice…
      </p>
    );
  }

  return (
    <p className="text-center text-sm text-muted-foreground dark:text-gray-400">
      Completing your profile…
    </p>
  );
}
