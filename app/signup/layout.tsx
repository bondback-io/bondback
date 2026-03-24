import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign up",
  description:
    "Create a Bond Back account to list bond cleans or bid as a cleaner — Australian end of lease cleaning marketplace with secure payments.",
  alternates: { canonical: "/signup" },
  robots: { index: true, follow: true },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
