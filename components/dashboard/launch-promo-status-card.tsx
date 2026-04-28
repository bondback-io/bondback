import Link from "next/link";
import { format } from "date-fns";
import { Info, Sparkles } from "lucide-react";
import {
  buildLaunchPromoDashboardModel,
  launchPromoCalendarDaysRemaining,
  launchPromoMarketingMonthlyAirbnbRecurringCap,
  launchPromoMarketingPriceCapAud,
  launchPromoZeroFeeServiceTypes,
  type GlobalSettingsWithLaunchPromo,
  type LaunchPromoDashboardModel,
} from "@/lib/launch-promo";
import { SERVICE_TYPES, serviceTypeLabel } from "@/lib/service-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LaunchPromoStatusCardProps = {
  model: LaunchPromoDashboardModel;
  variant: "lister" | "cleaner";
  userId: string;
  settings: GlobalSettingsWithLaunchPromo | null;
};

const infoIconClass =
  "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-emerald-700/80 dark:text-emerald-300/90";

/**
 * Primary launch-promo surface for lister + cleaner dashboards: progress, countdown, CTAs, and fee rules.
 * (Slim dismissible bars were folded into this card so messaging stays consistent.)
 */
export function LaunchPromoStatusCard({
  model,
  variant,
  userId,
  settings,
}: LaunchPromoStatusCardProps) {
  const now = new Date();
  const daysLeft = launchPromoCalendarDaysRemaining(settings, now);
  const ctaHref = variant === "lister" ? "/listings/new" : "/find-jobs";
  const ctaLabel = variant === "lister" ? "Create Another Free Job" : "Browse Jobs as Cleaner";

  const zeroFeeTypes = launchPromoZeroFeeServiceTypes(settings);
  const feeFreeLabels = zeroFeeTypes.map((k) => serviceTypeLabel(k));
  const standardFeeLabels = SERVICE_TYPES.filter((k) => !zeroFeeTypes.includes(k)).map((k) =>
    serviceTypeLabel(k)
  );
  const mktMonthly = launchPromoMarketingMonthlyAirbnbRecurringCap(settings);
  const mktPrice = launchPromoMarketingPriceCapAud(settings);

  const feeRulesTooltip =
    (feeFreeLabels.length > 0
      ? `Fee-free at escrow release: ${feeFreeLabels.join(", ")}. `
      : "No service types are set for fee-free promo — standard fees apply everywhere. ") +
    (standardFeeLabels.length > 0
      ? `Standard platform fee for: ${standardFeeLabels.join(", ")}.`
      : "");

  const monthlyTooltip =
    `Planned: up to ${mktMonthly} Airbnb or recurring listings per calendar month ` +
    `with starting price at or below $${mktPrice} AUD may stack with other offers. ` +
    "Monthly usage counters will appear here when enabled in the backend.";

  if (model.phase === "ended") {
    return (
      <section
        className="overflow-hidden rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-slate-50/95 to-emerald-50/30 px-4 py-4 shadow-sm dark:border-emerald-900/40 dark:from-slate-950 dark:to-emerald-950/20 sm:px-5 sm:py-5"
        aria-labelledby={`launch-promo-ended-${userId}`}
      >
        <div className="flex flex-wrap items-start gap-2 border-b border-emerald-200/40 pb-3 dark:border-emerald-800/40">
          <Sparkles className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <h2
            id={`launch-promo-ended-${userId}`}
            className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100"
          >
            Launch promo ended
          </h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          Promo ended – normal{" "}
          <span className="font-semibold tabular-nums text-emerald-900 dark:text-emerald-200">
            {model.normalFeePercent}%
          </span>{" "}
          platform fee now applies on new jobs.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          Thanks for helping us launch Bond Back. You can still post and book with secure escrow — fees support
          marketplace operations and support.
        </p>
        {model.showBondProNudge ? (
          <p className="mt-3 rounded-lg border border-emerald-200/60 bg-white/70 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            <span className="font-medium">Bond Pro</span> — lower fees and pro tools are on the roadmap. We&apos;ll
            surface enrollment here when it&apos;s ready.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-emerald-600/40 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-100 dark:hover:bg-emerald-950/50"
          >
            <Link href={ctaHref}>{variant === "lister" ? "Post a new job" : "Browse open jobs"}</Link>
          </Button>
        </div>
      </section>
    );
  }

  if (model.phase === "completed") {
    return (
      <section
        className="overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/40 px-4 py-4 shadow-sm dark:border-emerald-800/50 dark:from-emerald-950/40 dark:via-slate-950 dark:to-emerald-950/25 sm:px-5 sm:py-5"
        aria-labelledby={`launch-promo-complete-${userId}`}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-emerald-200/50 pb-3 dark:border-emerald-800/40">
          <Sparkles className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <h2
            id={`launch-promo-complete-${userId}`}
            className="text-base font-semibold tracking-tight text-emerald-900 dark:text-emerald-100"
          >
            🎉 Launch promo — all free slots used
          </h2>
        </div>
        <p className="mt-3 text-sm font-medium text-emerald-900 dark:text-emerald-100">
          You&apos;ve used{" "}
          <span className="tabular-nums font-bold">{model.freeSlots}</span> of{" "}
          <span className="tabular-nums font-bold">{model.freeSlots}</span> fee-free jobs.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900/90 dark:text-emerald-200/90" title={feeRulesTooltip}>
          Standard platform fees apply to your next completions. Fee-free slots applied first to:{" "}
          {feeFreeLabels.length > 0 ? feeFreeLabels.join(", ") : "no types (check admin settings)"}.
        </p>
        {model.showBondProNudge ? (
          <p className="mt-3 text-sm text-emerald-800 dark:text-emerald-300">
            <span className="font-medium">Bond Pro</span> — we&apos;ll highlight savings here when it launches.
          </p>
        ) : null}
        <div className="mt-4">
          <Button
            asChild
            size="sm"
            className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </section>
    );
  }

  const { used, freeSlots, endsAt } = model;
  const pct = Math.min(100, Math.round((used / Math.max(1, freeSlots)) * 100));
  const countdownLabel =
    daysLeft != null
      ? daysLeft === 0
        ? "Ends in less than a day"
        : `Ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
      : "No fixed end date — use your slots while the offer runs";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border shadow-md",
        "border-emerald-200/90 bg-gradient-to-br from-emerald-50/98 via-white to-teal-50/45",
        "dark:border-emerald-800/50 dark:from-emerald-950/45 dark:via-slate-950 dark:to-emerald-950/25"
      )}
      aria-labelledby={`launch-promo-active-${userId}`}
    >
      {/* Slim top strip — persistent summary */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-emerald-200/60 bg-emerald-600/[0.07] px-3 py-2 text-[11px] font-medium text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-500/10 dark:text-emerald-100 sm:px-4 sm:text-xs">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>🎉</span>
          Launch promo active
        </span>
        <span className="hidden text-emerald-800/80 dark:text-emerald-200/80 sm:inline">·</span>
        <span className="text-emerald-900/90 dark:text-emerald-100/90">{countdownLabel}</span>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id={`launch-promo-active-${userId}`}
              className="text-lg font-bold tracking-tight text-emerald-950 dark:text-emerald-50"
            >
              🎉 Launch Promo Active
            </h2>
            <p className="mt-1 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              Progress:{" "}
              <span className="tabular-nums">
                {used} of {freeSlots}
              </span>{" "}
              free jobs used
            </p>
          </div>
          <Button
            asChild
            className="h-10 shrink-0 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>

        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-900/55"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={freeSlots}
          aria-valuenow={used}
          aria-label={`${used} of ${freeSlots} promo jobs used`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-[width] duration-300 dark:from-emerald-400 dark:to-teal-400"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-emerald-900 dark:text-emerald-200">
          <span className="font-medium">{countdownLabel}</span>
          {endsAt ? (
            <>
              <span className="text-emerald-700/70 dark:text-emerald-300/60">·</span>
              <time dateTime={endsAt.toISOString()} className="text-emerald-800/90 dark:text-emerald-200/85">
                Window ends {format(endsAt, "d MMM yyyy")}
              </time>
            </>
          ) : null}
        </div>

        <div className="rounded-xl border border-emerald-200/70 bg-white/70 px-3 py-2.5 text-xs leading-relaxed text-emerald-950/95 dark:border-emerald-800/50 dark:bg-emerald-950/20 dark:text-emerald-100/90">
          <span className="inline-flex items-start gap-1.5">
            <Info className={cn(infoIconClass, "mt-0.5")} aria-hidden />
            <span>
              <span className="font-semibold">Fee-free slots</span> apply at escrow release for:{" "}
              {feeFreeLabels.length > 0 ? feeFreeLabels.join(", ") : "no types (admin config)"}.{" "}
              <span className="whitespace-nowrap font-medium" title={monthlyTooltip}>
                Free tier: up to {mktMonthly} Airbnb / recurring jobs / mo (≤${mktPrice} start) — full calendar
                tracking coming soon.
              </span>
            </span>
          </span>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-emerald-900/75 dark:text-emerald-300/80 sm:text-xs">
          <Info className={cn(infoIconClass, "mt-0.5")} aria-hidden />
          <span title={feeRulesTooltip}>
            {standardFeeLabels.length > 0
              ? `${standardFeeLabels.join(", ")}: standard platform fee unless included above.`
              : "All marketplace types may use fee-free slots per admin configuration."}
          </span>
        </p>
      </div>
    </section>
  );
}

/** Server helper: build model + card props in one call from dashboard pages. */
export function launchPromoCardPropsFromDashboard(params: {
  used: number;
  settings: GlobalSettingsWithLaunchPromo | null;
  normalFeePercent: number;
  variant: "lister" | "cleaner";
  userId: string;
}): { model: LaunchPromoDashboardModel; cardProps: LaunchPromoStatusCardProps } {
  const model = buildLaunchPromoDashboardModel({
    used: params.used,
    settings: params.settings,
    now: new Date(),
    normalFeePercent: params.normalFeePercent,
  });
  return {
    model,
    cardProps: {
      model,
      variant: params.variant,
      userId: params.userId,
      settings: params.settings,
    },
  };
}
