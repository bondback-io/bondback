import Link from "next/link";
import { format } from "date-fns";
import { Info, Sparkles } from "lucide-react";
import {
  buildLaunchPromoDashboardModel,
  launchPromoCalendarDaysRemaining,
  launchPromoCalendarDaysRemainingForLister,
  launchPromoMarketingMonthlyAirbnbRecurringCap,
  launchPromoMarketingPriceCapAud,
  ongoingFreeTierServiceTypes,
  type GlobalSettingsWithLaunchPromo,
  type LaunchPromoDashboardModel,
} from "@/lib/launch-promo";
import { SERVICE_TYPES, serviceTypeLabel } from "@/lib/service-types";
import { Button } from "@/components/ui/button";
import { CreateListingCtaButton } from "@/components/listing/create-listing-cta-button";
import { cn } from "@/lib/utils";
import { LaunchPromoCircularProgress } from "@/components/promo/launch-promo-circular-progress";

export type LaunchPromoStatusCardProps = {
  model: LaunchPromoDashboardModel;
  variant: "lister" | "cleaner";
  userId: string;
  settings: GlobalSettingsWithLaunchPromo | null;
  /** Lister: promo countdown uses signup + 90d vs global end. */
  profileCreatedAtIso?: string | null;
  /** Lister: completed 0% jobs this Sydney month (Airbnb / recurring ongoing tier). */
  freeTierJobsUsedThisMonth?: number;
  freeTierMonthlyCap?: number;
  freeTierPriceCapAud?: number;
};

const infoIconClass =
  "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-emerald-700/80 dark:text-emerald-300/90";

/**
 * Primary launch-promo surface for lister + cleaner dashboards: large ring progress, countdown, CTAs, fee rules.
 */
export function LaunchPromoStatusCard({
  model,
  variant,
  userId,
  settings,
  profileCreatedAtIso,
  freeTierJobsUsedThisMonth,
  freeTierMonthlyCap: freeTierMonthlyCapProp,
  freeTierPriceCapAud: freeTierPriceCapProp,
}: LaunchPromoStatusCardProps) {
  const now = new Date();
  const daysLeft =
    variant === "lister" && profileCreatedAtIso
      ? launchPromoCalendarDaysRemainingForLister(settings, profileCreatedAtIso, now)
      : launchPromoCalendarDaysRemaining(settings, now);
  const ctaHref = variant === "lister" ? "/listings/new" : "/find-jobs";
  const ctaLabel = variant === "lister" ? "Create Another Free Job" : "Browse Jobs as Cleaner";

  const ongoingLabels = ongoingFreeTierServiceTypes().map((k) => serviceTypeLabel(k));
  const standardFeeLabels = SERVICE_TYPES.filter(
    (k) => !(ongoingFreeTierServiceTypes() as readonly string[]).includes(k)
  ).map((k) => serviceTypeLabel(k));
  const mktMonthly =
    typeof freeTierMonthlyCapProp === "number"
      ? freeTierMonthlyCapProp
      : launchPromoMarketingMonthlyAirbnbRecurringCap(settings);
  const mktPrice =
    typeof freeTierPriceCapProp === "number"
      ? freeTierPriceCapProp
      : launchPromoMarketingPriceCapAud(settings);

  const feeRulesTooltip =
    `Launch: 0% platform fee on your first completed jobs (any service type) while the global promo is on and within 90 days of signup. ` +
    `Ongoing free tier: up to ${mktMonthly} ${ongoingLabels.join(" / ")} jobs per Sydney calendar month with job amount at or below $${mktPrice} AUD; ` +
    `Bond clean and deep/spring clean use the standard fee with no monthly cap.`;

  const monthlyTooltip =
    `Airbnb & recurring: up to ${mktMonthly} fee-free completions per Sydney calendar month when the job amount is at or below $${mktPrice} AUD.`;

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
          {variant === "lister" ? (
            <CreateListingCtaButton
              size="sm"
              variant="outline"
              className="border-emerald-600/40 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-100 dark:hover:bg-emerald-950/50"
            >
              Post a new job
            </CreateListingCtaButton>
          ) : (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-emerald-600/40 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-100 dark:hover:bg-emerald-950/50"
            >
              <Link href={ctaHref}>Browse open jobs</Link>
            </Button>
          )}
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
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
          <LaunchPromoCircularProgress
            used={model.freeSlots}
            total={model.freeSlots}
            aria-label={`All ${model.freeSlots} of ${model.freeSlots} free jobs completed`}
            className="mx-auto md:mx-0"
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2 border-b border-emerald-200/50 pb-3 dark:border-emerald-800/40">
              <Sparkles className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <h2
                id={`launch-promo-complete-${userId}`}
                className="text-base font-semibold tracking-tight text-emerald-900 dark:text-emerald-100"
              >
                🎉 Launch promo — all free slots used
              </h2>
            </div>
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              You&apos;ve used every fee-free job in this launch offer — amazing work.
            </p>
            <p className="text-sm leading-relaxed text-emerald-900/90 dark:text-emerald-200/90" title={feeRulesTooltip}>
              Standard platform fees apply to your next completions. Your launch promo covered any service type; the
              ongoing Airbnb / recurring monthly tier may still apply on eligible jobs.
            </p>
            {model.showBondProNudge ? (
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                <span className="font-medium">Bond Pro</span> — we&apos;ll highlight savings here when it launches.
              </p>
            ) : null}
            {variant === "lister" ? (
              <CreateListingCtaButton
                size="lg"
                className="h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:w-auto"
              >
                {ctaLabel}
              </CreateListingCtaButton>
            ) : (
              <Button
                asChild
                size="lg"
                className="h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:w-auto"
              >
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    );
  }

  const { used, freeSlots, endsAt } = model;
  const pctBar = Math.min(100, Math.round((used / Math.max(1, freeSlots)) * 100));
  const countdownLabel =
    daysLeft != null
      ? daysLeft === 0
        ? "Promo ends in less than a day"
        : `Promo ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
      : "Promo window — use your slots while the offer runs (90-day launch program)";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border-2 shadow-lg ring-1 ring-emerald-500/15",
        "border-emerald-300/80 bg-gradient-to-br from-emerald-50/98 via-white to-teal-50/50",
        "dark:border-emerald-700/50 dark:from-emerald-950/50 dark:via-slate-950 dark:to-emerald-950/30 dark:ring-emerald-400/10"
      )}
      aria-labelledby={`launch-promo-active-${userId}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-emerald-200/60 bg-emerald-600/10 px-3 py-2.5 text-xs font-semibold text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-500/10 dark:text-emerald-100 sm:px-5 sm:text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden>🎉</span>
          0% fee launch promo — active
        </span>
        <span className="hidden text-emerald-700/70 dark:text-emerald-300/70 sm:inline">·</span>
        <span className="text-emerald-900/95 dark:text-emerald-100/90">{countdownLabel}</span>
      </div>

      <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:gap-10">
        <LaunchPromoCircularProgress
          used={used}
          total={freeSlots}
          aria-label={`${used} of ${freeSlots} free jobs completed`}
          className="mx-auto lg:mx-0"
        />

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2
              id={`launch-promo-active-${userId}`}
              className="text-pretty text-xl font-bold tracking-tight text-emerald-950 dark:text-emerald-50 sm:text-2xl"
            >
              Keep going — you&apos;re saving on platform fees
            </h2>
            <p className="mt-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200 sm:text-base">
              <span className="tabular-nums text-lg font-extrabold sm:text-xl">{used}</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300"> of </span>
              <span className="tabular-nums text-lg font-extrabold sm:text-xl">{freeSlots}</span>
              <span className="font-medium"> free jobs completed</span>
            </p>
          </div>

          {/* Secondary horizontal bar reinforces ring on wide screens */}
          <div
            className="h-3 w-full max-w-xl overflow-hidden rounded-full bg-emerald-200/80 dark:bg-emerald-900/55"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={freeSlots}
            aria-valuenow={used}
            aria-label={`${used} of ${freeSlots} promo jobs used`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 transition-[width] duration-500 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-300"
              style={{ width: `${pctBar}%` }}
            />
          </div>

          <div className="space-y-1 text-sm text-emerald-900 dark:text-emerald-200">
            <p className="font-medium">{countdownLabel}</p>
            {endsAt ? (
              <p className="text-xs text-emerald-800/90 dark:text-emerald-300/85">
                <time dateTime={endsAt.toISOString()}>Window ends {format(endsAt, "d MMM yyyy")}</time>
              </p>
            ) : null}
            <p
              className="rounded-lg border border-emerald-200/70 bg-white/75 px-3 py-2 text-xs leading-snug text-emerald-950/95 dark:border-emerald-800/50 dark:bg-emerald-950/25 dark:text-emerald-100/90 sm:text-sm"
              title={monthlyTooltip}
            >
              <span className="font-semibold">This month (Airbnb / recurring tier):</span>{" "}
              {variant === "lister" && typeof freeTierJobsUsedThisMonth === "number" ? (
                <>
                  {freeTierJobsUsedThisMonth} of {mktMonthly} free jobs (≤ ${mktPrice} AUD) — resets each calendar
                  month (Sydney).
                </>
              ) : (
                <>
                  Up to {mktMonthly} jobs at ≤ {mktPrice} AUD per month for {ongoingLabels.join(" / ")}.
                </>
              )}
            </p>
          </div>

          {variant === "lister" ? (
            <CreateListingCtaButton
              size="lg"
              className="h-12 w-full rounded-xl bg-emerald-600 text-base font-bold text-white shadow-md shadow-emerald-900/20 hover:bg-emerald-700 dark:bg-emerald-600 dark:shadow-emerald-950/30 dark:hover:bg-emerald-500 sm:w-auto sm:min-w-[240px]"
            >
              {ctaLabel}
            </CreateListingCtaButton>
          ) : (
            <Button
              asChild
              size="lg"
              className="h-12 w-full rounded-xl bg-emerald-600 text-base font-bold text-white shadow-md shadow-emerald-900/20 hover:bg-emerald-700 dark:bg-emerald-600 dark:shadow-emerald-950/30 dark:hover:bg-emerald-500 sm:w-auto sm:min-w-[240px]"
            >
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          )}

          <div className="rounded-xl border border-emerald-200/70 bg-white/70 px-3 py-2.5 text-xs leading-relaxed text-emerald-950/95 dark:border-emerald-800/50 dark:bg-emerald-950/20 dark:text-emerald-100/90">
            <span className="inline-flex items-start gap-1.5">
              <Info className={cn(infoIconClass, "mt-0.5")} aria-hidden />
              <span>
                <span className="font-semibold">Launch promo</span> uses your remaining slots on{" "}
                <span className="font-medium">any</span> service type.{" "}
                <span className="font-semibold">Monthly tier</span> applies only to {ongoingLabels.join(" & ")}.
              </span>
            </span>
          </div>

          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-emerald-900/75 dark:text-emerald-300/80 sm:text-xs">
            <Info className={cn(infoIconClass, "mt-0.5")} aria-hidden />
            <span title={feeRulesTooltip}>
              {standardFeeLabels.length > 0
                ? `${standardFeeLabels.join(", ")}: standard platform fee except where launch or monthly Airbnb / recurring tier applies.`
                : "Fees follow launch promo, then monthly Airbnb / recurring rules, then standard rates."}
            </span>
          </p>
        </div>
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
