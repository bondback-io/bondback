import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Set new password",
  description: "Choose a new password for your Bond Back account.",
  alternates: { canonical: "/reset-password" },
  robots: { index: false, follow: true },
};

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
