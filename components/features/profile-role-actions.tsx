"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { setActiveRole } from "@/lib/actions/profile";
import type { ProfileRole } from "@/lib/types";

export type ProfileRoleActionsProps = {
  roles: ProfileRole[];
  activeRole: ProfileRole | null;
};

export function ProfileRoleActions({
  roles,
  activeRole,
}: ProfileRoleActionsProps) {
  const [isPending, startTransition] = useTransition();

  const hasLister = roles.includes("lister");
  const hasCleaner = roles.includes("cleaner");

  const handleSwitch = (role: ProfileRole) => {
    if (!roles.includes(role) || activeRole === role) return;
    startTransition(async () => {
      await setActiveRole(role);
    });
  };

  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
      {hasLister && hasCleaner ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="font-medium text-foreground dark:text-gray-100">Active mode</p>
            <p className="text-[11px] dark:text-gray-400">
              Choose how you want to use Bond Back right now.
            </p>
          </div>
          <div className="inline-flex overflow-hidden rounded-full border border-gray-200 bg-gray-100/80 p-0.5 text-[11px] dark:border-gray-600 dark:bg-gray-800">
            <Button
              size="xs"
              variant="ghost"
              className={
                activeRole === "lister"
                  ? "rounded-full bg-sky-600 px-3 py-1.5 text-white shadow-sm hover:bg-sky-700 dark:bg-sky-500 dark:text-white dark:hover:bg-sky-600"
                  : "rounded-full px-3 py-1.5 text-sky-700 hover:bg-sky-100/80 dark:bg-transparent dark:text-sky-200 dark:hover:bg-gray-700 dark:hover:text-sky-100"
              }
              disabled={isPending || activeRole === "lister"}
              onClick={() => handleSwitch("lister")}
            >
              Lister
            </Button>
            <Button
              size="xs"
              variant="ghost"
              className={
                activeRole === "cleaner"
                  ? "rounded-full bg-emerald-600 px-3 py-1.5 text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-600"
                  : "rounded-full px-3 py-1.5 text-emerald-700 hover:bg-emerald-100/80 dark:bg-transparent dark:text-emerald-200 dark:hover:bg-gray-700 dark:hover:text-emerald-100"
              }
              disabled={isPending || activeRole === "cleaner"}
              onClick={() => handleSwitch("cleaner")}
            >
              Cleaner
            </Button>
          </div>
        </div>
      ) : hasLister ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="font-medium text-foreground dark:text-gray-100">
              You&apos;re currently set up as a Lister.
            </p>
            <p className="text-[11px] dark:text-gray-400">
              Add a Cleaner profile if you also want to bid on jobs.
            </p>
          </div>
          <Button
            asChild
            size="xs"
            variant="outline"
            className="text-emerald-700 dark:text-emerald-300 dark:border-gray-600 dark:hover:bg-emerald-900/30"
          >
            <Link href="/onboarding?role=cleaner">
              Set up a Cleaner profile
            </Link>
          </Button>
        </div>
      ) : hasCleaner ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="font-medium text-foreground dark:text-gray-100">
              You&apos;re currently set up as a Cleaner.
            </p>
            <p className="text-[11px] dark:text-gray-400">
              Add a Lister profile if you also want to auction your own bond
              cleans.
            </p>
          </div>
          <Button
            asChild
            size="xs"
            variant="outline"
            className="text-sky-700 dark:text-sky-300 dark:border-gray-600 dark:hover:bg-sky-900/30"
          >
            <Link href="/onboarding">
              Set up a Lister profile
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

