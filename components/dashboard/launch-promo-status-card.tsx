import { format } from "date-fns";
import type { LaunchPromoDashboardModel } from "@/lib/launch-promo";
import { cn } from "@/lib/utils";

export type LaunchPromoStatusCardProps = {
  model: LaunchPromoDashboardModel;
};

/**
 * 0% Fee Launch Promo — lister + cleaner dashboards (after welcome greeting).
 */
export function LaunchPromoStatusCard({ model }: LaunchPromoStatusCardProps) {
  if (model.phase === "ended") {
    return (
      <section
        className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50 sm:px-5 sm:py-4"
        aria-labelledby="launch-promo-ended-heading"
      >
        <h2
          id="launch-promo-ended-heading"
          className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100"
        >
          Promo status
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Promo ended — normal{" "}
          <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
            {model.normalFeePercent}%
          </span>{" "}
          platform fee now applies on new jobs.
        </p>
        {model.showBondProNudge ? (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            <span className="font-medium">Bond Pro</span> — lower fees and more tools are coming soon.
            Watch this space.
          </p>
        ) : null}
      </section>
    );
  }

  if (model.phase === "completed") {
    return (
      <section
        className="rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 via-white to-emerald-50/40 px-4 py-4 shadow-sm dark:border-emerald-800/50 dark:from-emerald-950/35 dark:via-slate-950 dark:to-emerald-950/20 sm:px-5 sm:py-4"
        aria-labelledby="launch-promo-complete-heading"
      >
        <h2
          id="launch-promo-complete-heading"
          className="text-base font-semibold tracking-tight text-emerald-900 dark:text-emerald-100"
        >
          Launch promo 🎉
        </h2>
        <p className="mt-1 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          {model.freeSlots} free jobs completed
        </p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900/85 dark:text-emerald-200/90">
          You&apos;ve used all{" "}
          <span className="font-semibold tabular-nums">{model.freeSlots}</span> fee-free completions from
          this launch offer. Standard platform fees apply going forward.
        </p>
        {model.showBondProNudge ? (
          <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
            <span className="font-medium">Bond Pro</span> — we&apos;ll highlight savings here when it
            launches.
          </p>
        ) : null}
      </section>
    );
  }

  const { used, freeSlots, endsAt } = model;
  const pct = Math.min(100, Math.round((used / Math.max(1, freeSlots)) * 100));

  return (
    <section
      className={cn(
        "rounded-2xl border px-4 py-4 shadow-sm sm:px-5 sm:py-4",
        "border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/50",
        "dark:border-emerald-800/45 dark:from-emerald-950/40 dark:via-slate-950 dark:to-emerald-950/25"
      )}
      aria-labelledby="launch-promo-active-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2
          id="launch-promo-active-heading"
          className="text-base font-semibold tracking-tight text-emerald-900 dark:text-emerald-100"
        >
          Launch Promo Active 🎉
        </h2>
      </div>
      <p className="mt-1 text-sm font-medium text-emerald-800 dark:text-emerald-200">
        You have used{" "}
        <span className="tabular-nums font-semibold">
          {used} of {freeSlots}
        </span>{" "}
        free jobs
      </p>
      <p className="mt-2 text-sm leading-relaxed text-emerald-900/90 dark:text-emerald-100/85">
        {endsAt ? (
          <>
            Promo ends on{" "}
            <time dateTime={endsAt.toISOString()} className="font-semibold">
              {format(endsAt, "d MMM yyyy")}
            </time>
            .
          </>
        ) : (
          <>No fixed end date — complete your free slots while the launch offer runs.</>
        )}
      </p>
      <p className="mt-2 text-sm text-emerald-800/95 dark:text-emerald-200/90">
        <span className="font-semibold">0% platform fee</span> on your first{" "}
        <span className="tabular-nums font-semibold">{freeSlots}</span> completed jobs (applied when
        escrow releases).
      </p>
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-emerald-200/60 dark:bg-emerald-900/50"
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
    </section>
  );
}
