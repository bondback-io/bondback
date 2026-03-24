import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact support",
  description:
    "Contact Bond Back support for help with bond cleaning jobs, payments, or account issues — Australia.",
  alternates: { canonical: "/support" },
  robots: { index: false, follow: true },
};

export default function SupportLayout({ children }: { children: ReactNode }) {
  return children;
}
