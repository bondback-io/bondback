import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Log in",
  description:
    "Log in to Bond Back to post bond cleaning jobs, place bids on end of lease cleans, and manage your rental bond workflow in Australia.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
