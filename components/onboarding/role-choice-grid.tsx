"use client";

import { memo } from "react";
import Link from "next/link";
import { Brush, Home } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RoleChoiceGridProps = {
  error: string | null;
  savingChoice: "lister" | "cleaner" | null;
  optimisticChoice: "lister" | "cleaner" | null;
  onChoice: (choice: "lister" | "cleaner") => void;
};

const btnTouch =
  "touch-manipulation min-h-[3.25rem] w-full shrink-0 text-base font-semibold transition-transform duration-150 active:scale-[0.98] sm:min-h-12";

function RoleChoiceGridInner({
  error,
  savingChoice,
  optimisticChoice,
  onChoice,
}: RoleChoiceGridProps) {
  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col justify-center gap-6 px-3 py-8 sm:max-w-2xl md:max-w-4xl md:py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          How do you want to use Bond Back?
        </h1>
        <p className="text-pretty text-base text-muted-foreground sm:text-lg">
          Pick one to start — you can unlock the other role anytime in Settings.
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 md:gap-8">
        <Card
          className={cn(
            "flex flex-col border-2 shadow-md transition-colors duration-200 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none",
            optimisticChoice === "lister"
              ? "border-sky-500/70 ring-2 ring-sky-500/25 dark:border-sky-500/60"
              : "border-transparent"
          )}
        >
          <CardHeader className="space-y-4 pb-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-900/50">
              <Home className="h-9 w-9 text-sky-600 dark:text-sky-300" aria-hidden />
            </div>
            <CardTitle className="text-xl font-bold sm:text-2xl">I want to LIST bond cleans</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Post end-of-lease cleans, compare bids, and hire cleaners you trust.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex flex-1 flex-col gap-4 pt-0">
            <ul className="space-y-2 text-sm text-muted-foreground sm:text-base">
              <li>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">+</span> Earn back your bond with
                competitive quotes
              </li>
              <li>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">+</span> Manage listings &amp;
                payments in one place
              </li>
              <li>
                <span className="font-medium text-amber-700 dark:text-amber-400">−</span> You coordinate access &amp;
                property details
              </li>
            </ul>
            <Button
              type="button"
              size="lg"
              className={cn(btnTouch)}
              disabled={savingChoice != null}
              onClick={() => onChoice("lister")}
            >
              {savingChoice === "lister" ? "Starting…" : "Start as Lister"}
            </Button>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "flex flex-col border-2 shadow-md transition-colors duration-200 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none",
            optimisticChoice === "cleaner"
              ? "border-emerald-500/70 ring-2 ring-emerald-500/25 dark:border-emerald-500/60"
              : "border-transparent"
          )}
        >
          <CardHeader className="space-y-4 pb-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40">
              <Brush className="h-9 w-9 text-emerald-700 dark:text-emerald-300" aria-hidden />
            </div>
            <CardTitle className="text-xl font-bold sm:text-2xl">I want to CLEAN</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Find bond cleans near you, place bids, and get paid for quality work.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex flex-1 flex-col gap-4 pt-0">
            <ul className="space-y-2 text-sm text-muted-foreground sm:text-base">
              <li>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">+</span> Flexible jobs &amp;
                transparent bidding
              </li>
              <li>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">+</span> Build reviews &amp;
                repeat clients
              </li>
              <li>
                <span className="font-medium text-amber-700 dark:text-amber-400">−</span> Travel &amp; equipment are on
                you
              </li>
            </ul>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className={cn(
                btnTouch,
                "border border-emerald-600/30 bg-emerald-600 text-white hover:bg-emerald-600/90 dark:border-emerald-500/30"
              )}
              disabled={savingChoice != null}
              onClick={() => onChoice("cleaner")}
            >
              {savingChoice === "cleaner" ? "Starting…" : "Start as Cleaner"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-base text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}

export const RoleChoiceGrid = memo(RoleChoiceGridInner);
