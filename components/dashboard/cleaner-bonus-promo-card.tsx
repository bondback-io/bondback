import Link from "next/link";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type CleanerBonusPromoCardProps = {
  bonusPct: number;
  maxJobs: number;
  durationDays: number;
  jobsUsed: number;
  startDateIso: string | null;
};

/**
 * Dashboard banner while the cleaner is still inside the rolling cleaner-bonus promo window.
 */
export function CleanerBonusPromoCard({
  bonusPct,
  maxJobs,
  durationDays,
  jobsUsed,
  startDateIso,
}: CleanerBonusPromoCardProps) {
  const safeMax = Math.max(1, maxJobs);
  const used = Math.min(safeMax, Math.max(0, jobsUsed));
  const remaining = Math.max(0, safeMax - used);
  const progressPct = Math.round((used / safeMax) * 100);

  let windowHint: string;
  const trimmed = String(startDateIso ?? "").trim();
  if (trimmed) {
    const start = new Date(trimmed);
    if (Number.isFinite(start.getTime())) {
      const endMs = start.getTime() + durationDays * 86_400_000;
      const daysLeft = Math.max(0, Math.ceil((endMs - Date.now()) / 86_400_000));
      windowHint =
        daysLeft === 0
          ? "Promo window ends today."
          : `About ${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your promo window.`;
    } else {
      windowHint = `You have up to ${remaining} bonus job${remaining === 1 ? "" : "s"} remaining.`;
    }
  } else {
    windowHint = `Complete a paid job to start your ${durationDays}-day window — up to ${remaining} bonus job${remaining === 1 ? "" : "s"} while eligible.`;
  }

  return (
    <Card className="border-violet-200/90 bg-gradient-to-br from-violet-50/90 via-card to-background shadow-md dark:border-violet-900/55 dark:from-violet-950/45 dark:via-gray-950 dark:to-gray-950">
      <CardHeader className="space-y-2 pb-2 pt-5 sm:pt-4">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight text-violet-950 dark:text-violet-100 sm:text-base">
          <Gift className="size-5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
          Cleaner bonus promo
        </CardTitle>
        <CardDescription className="text-sm leading-snug text-muted-foreground dark:text-gray-400">
          Earn around <strong className="text-foreground dark:text-gray-200">{bonusPct}%</strong> extra on
          eligible releases — paid from the platform fee on that payout (no extra lister charge).{" "}
          <span className="whitespace-nowrap">
            {used} of {safeMax} bonus jobs used
          </span>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-5 pt-0 sm:pb-4">
        <div className="space-y-1.5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-violet-200/60 dark:bg-violet-900/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-300 dark:from-violet-400 dark:to-fuchsia-400"
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={used}
              aria-valuemin={0}
              aria-valuemax={safeMax}
              aria-label={`${used} of ${safeMax} cleaner promo bonus jobs used`}
            />
          </div>
          <p className="text-xs leading-snug text-muted-foreground dark:text-gray-400">{windowHint}</p>
        </div>
        <Button
          asChild
          className="w-full bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500 sm:w-auto"
        >
          <Link href="/jobs">Browse more jobs</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
