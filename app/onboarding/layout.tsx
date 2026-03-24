import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  description:
    "Set up your Bond Back account to list bond cleans or bid as a cleaner — end of lease cleaning marketplace in Australia.",
  robots: { index: false, follow: true },
};

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return children;
}
