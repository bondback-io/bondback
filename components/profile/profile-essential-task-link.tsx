"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ProfileEssentialTaskLinkProps = {
  /** DOM id / URL hash fragment without # (e.g. phone, date_of_birth, profile-photo, section-personal) */
  fieldId: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Deep-link to /profile#fieldId and ensure hashchange runs so MyAccountSections
 * opens the Personal info accordion and scrolls to the field.
 */
export function ProfileEssentialTaskLink({
  fieldId,
  className,
  children,
}: ProfileEssentialTaskLinkProps) {
  const href = `/profile#${fieldId}`;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (typeof window === "undefined") return;

    const targetHash = `#${fieldId}`;
    const base = window.location.pathname + window.location.search;

    if (window.location.pathname !== "/profile") {
      window.location.assign(href);
      return;
    }

    if (window.location.hash === targetHash) {
      window.history.replaceState(null, "", base);
      window.requestAnimationFrame(() => {
        window.location.hash = fieldId;
      });
    } else {
      window.location.hash = fieldId;
    }
  };

  return (
    <a href={href} className={cn(className)} onClick={handleClick}>
      {children}
    </a>
  );
}
