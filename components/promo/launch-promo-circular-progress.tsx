import { cn } from "@/lib/utils";

type LaunchPromoCircularProgressProps = {
  /** Jobs completed under promo (0 … total). */
  used: number;
  /** Total free slots from global settings. */
  total: number;
  className?: string;
  /** Accessible label, e.g. "3 of 5 free jobs completed". */
  "aria-label": string;
};

/**
 * Large SVG ring for dashboard promo card — motivational progress at a glance.
 */
export function LaunchPromoCircularProgress({
  used,
  total,
  className,
  "aria-label": ariaLabel,
}: LaunchPromoCircularProgressProps) {
  const safeTotal = Math.max(1, total);
  const u = Math.min(Math.max(0, used), safeTotal);
  const pct = u / safeTotal;
  const size = 200;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - pct);

  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto max-h-[min(52vw,220px)] max-w-[min(52vw,220px)] sm:max-h-[220px] sm:max-w-[220px]"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-emerald-200/90 dark:stroke-emerald-900/70"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-emerald-500 transition-[stroke-dashoffset] duration-500 dark:stroke-emerald-400"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dash}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90 dark:text-emerald-200/90 sm:text-[11px]">
          0% fee
        </p>
        <p className="mt-0.5 text-3xl font-extrabold tabular-nums leading-none text-emerald-950 dark:text-emerald-50 sm:text-4xl">
          {u}
          <span className="text-xl font-bold text-emerald-700/80 dark:text-emerald-300/80 sm:text-2xl">
            {" "}
            / {safeTotal}
          </span>
        </p>
        <p className="mt-0.5 max-w-[8.5rem] text-[10px] font-medium leading-tight text-emerald-900/85 dark:text-emerald-100/85 sm:text-[11px]">
          free jobs done
        </p>
      </div>
    </div>
  );
}
