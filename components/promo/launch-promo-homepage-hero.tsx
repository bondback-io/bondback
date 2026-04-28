import Link from "next/link";
import { ArrowRight, Shield, Sparkles } from "lucide-react";
import { getCachedGlobalSettingsForPages } from "@/lib/cached-global-settings-read";
import {
  launchPromoCalendarDaysRemaining,
  launchPromoFreeJobSlots,
  launchPromoPublicBannerVisible,
  type GlobalSettingsWithLaunchPromo,
} from "@/lib/launch-promo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Full-width homepage promo hero. Server-rendered; uses cached global settings.
 */
export async function LaunchPromoHomepageHero() {
  const settings = (await getCachedGlobalSettingsForPages()) as GlobalSettingsWithLaunchPromo | null;
  const now = new Date();
  if (!launchPromoPublicBannerVisible(settings, now)) return null;

  const freeSlots = launchPromoFreeJobSlots(settings);
  const daysLeft = launchPromoCalendarDaysRemaining(settings, now);
  /** Marketing headline: dynamic slot count from admin (`launch_promo_free_job_slots`). */
  const headline = `🎉 Launch Offer: First ${freeSlots} Jobs Are 100% Fee-Free!`;

  const sub =
    daysLeft != null ? (
      <>
        No platform fees for your first {freeSlots} completed cleans •{" "}
        <span className="font-semibold text-emerald-900 dark:text-emerald-200">90-day</span> launch
        program • Ends in{" "}
        <span className="font-semibold text-emerald-900 dark:text-emerald-200">
          {daysLeft === 0 ? "less than a day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
        </span>
      </>
    ) : (
      <>
        No platform fees for your first {freeSlots} completed cleans •{" "}
        <span className="font-semibold text-emerald-900 dark:text-emerald-200">90 days</span>{" "}
        limited-time launch offer
      </>
    );

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden border-b border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40",
        "dark:border-emerald-900/50 dark:from-emerald-950/80 dark:via-gray-950 dark:to-emerald-950/30"
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
        aria-hidden
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, rgba(16, 185, 129, 0.25) 0%, transparent 45%),
            radial-gradient(circle at 80% 20%, rgba(52, 211, 153, 0.2) 0%, transparent 40%),
            radial-gradient(circle at 60% 80%, rgba(16, 185, 129, 0.15) 0%, transparent 35%)`,
        }}
      />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 text-emerald-400/20 dark:text-emerald-300/10">
        <Sparkles className="h-full w-full" strokeWidth={1} aria-hidden />
      </div>

      <div className="container relative max-w-5xl px-4 py-6 sm:px-6 sm:py-8 md:py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 shadow-sm dark:border-emerald-700/60 dark:bg-emerald-950/60 dark:text-emerald-100 sm:text-xs">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
            Launch promo
          </p>
          <h2 className="text-balance text-xl font-bold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl md:text-3xl">
            {headline}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-base">
            {sub}
          </p>

          <div className="mt-5 flex w-full flex-col gap-2.5 sm:mx-auto sm:max-w-lg sm:flex-row sm:justify-center sm:gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 min-h-[48px] w-full rounded-xl bg-emerald-600 text-base font-semibold text-white shadow-md shadow-emerald-900/15 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:flex-1 sm:max-w-[220px]"
            >
              <Link href="/listings/new">
                Post Your Job Free Now
                <ArrowRight className="ml-2 h-4 w-4 shrink-0 opacity-90" aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 min-h-[48px] w-full rounded-xl border-2 border-emerald-600/40 bg-white/90 text-base font-semibold text-emerald-900 backdrop-blur-sm hover:bg-emerald-50 dark:border-emerald-500/50 dark:bg-gray-900/80 dark:text-emerald-100 dark:hover:bg-emerald-950/50 sm:flex-1 sm:max-w-[220px]"
            >
              <Link href="/find-jobs">
                Browse Jobs as Cleaner
                <ArrowRight className="ml-2 h-4 w-4 shrink-0 opacity-90" aria-hidden />
              </Link>
            </Button>
          </div>

          <p className="mx-auto mt-4 flex max-w-xl flex-wrap items-center justify-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
            <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span>
              Money held safely in escrow • Available on all service types
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
