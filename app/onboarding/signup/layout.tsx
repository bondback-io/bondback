import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Onboarding signup",
  description:
    "Complete signup details for Bond Back — bond cleaning marketplace onboarding.",
};

export default function OnboardingSignupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
