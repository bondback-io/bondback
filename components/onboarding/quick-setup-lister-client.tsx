"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Home } from "lucide-react";

/**
 * Lister quick-setup: nudge to first listing, then dashboard.
 * Progress ring = step 2 of 2 (after role choice).
 */
export function QuickSetupListerClient() {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col justify-center gap-6 px-3 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <ProgressRing value={100} size={88} strokeWidth={7} label="2/2" />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-900/50">
          <Home className="h-8 w-8 text-sky-600 dark:text-sky-300" aria-hidden />
        </div>
        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
          Ready to create your first listing?
        </h1>
        <p className="text-pretty text-base text-muted-foreground sm:text-lg">
          Add photos, bond clean details, and a date — cleaners will start bidding.
        </p>
      </div>

      <Card className="border-border/80 shadow-md dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-lg">Next step</CardTitle>
          <CardDescription className="text-base">
            You can always return to your dashboard from the header menu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="min-h-14 w-full flex-1 text-base font-semibold sm:min-h-12"
          >
            <Link href="/listings/new">Create your first listing</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-14 w-full flex-1 text-base font-semibold sm:min-h-12"
            onClick={() => router.replace("/lister/dashboard")}
          >
            Go to dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
