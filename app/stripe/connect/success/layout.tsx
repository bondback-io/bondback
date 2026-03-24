import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Stripe connected",
  description:
    "Stripe Connect onboarding completed for Bond Back cleaner payouts.",
  robots: { index: false, follow: false },
};

export default function StripeConnectSuccessLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
