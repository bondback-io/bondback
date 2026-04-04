import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthConfirmClient } from "./auth-confirm-client";
import { AuthEmailConfirmTransitionLoader } from "@/components/onboarding/auth-email-confirm-transition-loader";

export const metadata: Metadata = {
  title: "Confirm email",
  robots: { index: false, follow: false },
};

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={<AuthEmailConfirmTransitionLoader variant="full" mode="linkConfirm" phaseLabel="Starting…" />}
    >
      <AuthConfirmClient />
    </Suspense>
  );
}
