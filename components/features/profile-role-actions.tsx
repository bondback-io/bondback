"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { setActiveRole } from "@/lib/actions/profile";
import type { ProfileRole } from "@/lib/types";
import { Brush, Home } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground dark:border-border dark:bg-muted/20">
      {hasLister && hasCleaner ? (
        <div className="space-y-3">
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">Active mode</p>
            <p className="text-xs text-muted-foreground">
              Choose how you want to use Bond Back right now.
            </p>
          </div>
          <div
            className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/50 p-1.5 dark:border-border dark:bg-muted/30"
            role="group"
            aria-label="Switch between Lister and Cleaner"
          >
            <button
              type="button"
              disabled={isPending || activeRole === "lister"}
              onClick={() => handleSwitch("lister")}
              className={cn(
                "flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-sm font-semibold transition-all sm:min-h-12",
                activeRole === "lister"
                  ? "bg-background text-foreground shadow-md ring-1 ring-sky-500/40 dark:bg-gray-950 dark:ring-sky-500/50"
                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground dark:hover:bg-gray-900/70"
              )}
            >
              <Home
                className={cn(
                  "h-5 w-5",
                  activeRole === "lister"
                    ? "text-sky-600 dark:text-sky-400"
                    : "opacity-70"
                )}
                aria-hidden
              />
              Lister
            </button>
            <button
              type="button"
              disabled={isPending || activeRole === "cleaner"}
              onClick={() => handleSwitch("cleaner")}
              className={cn(
                "flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-sm font-semibold transition-all sm:min-h-12",
                activeRole === "cleaner"
                  ? "bg-background text-foreground shadow-md ring-1 ring-emerald-500/40 dark:bg-gray-950 dark:ring-emerald-500/50"
                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground dark:hover:bg-gray-900/70"
              )}
            >
              <Brush
                className={cn(
                  "h-5 w-5",
                  activeRole === "cleaner"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "opacity-70"
                )}
                aria-hidden
              />
              Cleaner
            </button>
          </div>
        </div>
      ) : hasLister ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">
              You&apos;re currently set up as a Lister.
            </p>
            <p className="text-xs text-muted-foreground">
              Add a Cleaner profile if you also want to bid on jobs.
            </p>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-11 shrink-0 border-emerald-600/40 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
          >
            <Link href="/onboarding?role=cleaner">Set up Cleaner</Link>
          </Button>
        </div>
      ) : hasCleaner ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">
              You&apos;re currently set up as a Cleaner.
            </p>
            <p className="text-xs text-muted-foreground">
              Add a Lister profile if you also want to auction your own bond cleans.
            </p>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-11 shrink-0 border-sky-600/40 text-sky-800 hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-100 dark:hover:bg-sky-950/40"
          >
            <Link href="/onboarding">Set up Lister</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
