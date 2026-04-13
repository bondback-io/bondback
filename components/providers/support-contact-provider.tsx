"use client";

import * as React from "react";
import { getPublicSupportContactEmail } from "@/lib/support-contact-email";

const SupportContactContext = React.createContext<string | null>(null);

export function SupportContactProvider({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <SupportContactContext.Provider value={email}>{children}</SupportContactContext.Provider>
  );
}

/** Prefer email from root layout (server-resolved); fall back to public env or default. */
export function useSupportContactDisplayEmail(): string {
  const fromLayout = React.useContext(SupportContactContext);
  if (fromLayout && fromLayout.trim()) return fromLayout.trim();
  return getPublicSupportContactEmail();
}
