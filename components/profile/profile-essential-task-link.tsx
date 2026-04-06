"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type ProfileEssentialTaskLinkProps = {
  /** DOM id / URL hash fragment without # (e.g. phone, date_of_birth, profile-photo, section-personal) */
  fieldId: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Deep-link to `/profile#fieldId` so `MyAccountSections` opens Personal info and scrolls.
 * `href` includes the current query on `/profile` so `NavigationRouteProgress` does not treat
 * the click as a full navigation (hash-only; avoids a stuck ~90% loading bar).
 */
export function ProfileEssentialTaskLink({
  fieldId,
  className,
  children,
}: ProfileEssentialTaskLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href =
    pathname === "/profile"
      ? `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}#${fieldId}`
      : `/profile#${fieldId}`;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (typeof window === "undefined") return;

    const targetHash = `#${fieldId}`;

    if (window.location.pathname !== "/profile") {
      window.location.assign(`/profile#${fieldId}`);
      return;
    }

    if (window.location.hash === targetHash) {
      const base = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", base);
      window.requestAnimationFrame(() => {
        window.location.hash = fieldId;
      });
    } else {
      window.location.hash = fieldId;
    }
  };

  return (
    <a
      href={href}
      className={cn(className)}
      onClick={handleClick}
      data-skip-route-progress=""
    >
      {children}
    </a>
  );
}
