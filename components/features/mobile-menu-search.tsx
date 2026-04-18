"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FindJobsSearch } from "@/components/features/find-jobs-search";
import { cn } from "@/lib/utils";

export type MobileMenuSearchProps = {
  /** Called before navigation (e.g. close the sheet). */
  onNavigate?: () => void;
  className?: string;
};

/**
 * Compact find-jobs search for the mobile nav drawer — matches home/jobs UX (radius chips, near me).
 */
export function MobileMenuSearch({ onNavigate, className }: MobileMenuSearchProps) {
  const router = useRouter();

  return (
    <section
      className={cn("pb-2", className)}
      aria-label="Search bond cleans in your area"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
        Browse jobs near you
      </p>
      <FindJobsSearch
        variant="home"
        className="space-y-3"
        onNavigate={(href) => {
          onNavigate?.();
          router.push(href);
        }}
      />
    </section>
  );
}
