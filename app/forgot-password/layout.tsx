import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Forgot password",
  description:
    "Reset your Bond Back password — we’ll email you a secure link to choose a new password.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: true },
};

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
