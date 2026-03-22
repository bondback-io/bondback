"use client";

import { cn } from "@/lib/utils";

type ProfileCompletionMobileProps = {
  percent: number;
  message: string | null;
};

/**
 * Circular progress for profile completion — mobile-only usage (pair with `hidden md:block` linear bar on desktop).
 */
export function ProfileCompletionMobileRing({
  percent,
  message,
}: ProfileCompletionMobileProps) {
  const r = 52;
  const stroke = 8;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-3xl border-2 border-emerald-200/80 bg-emerald-50/50 px-6 py-8 dark:border-emerald-800/80 dark:bg-emerald-950/30"
      role="status"
      aria-label={`Profile ${percent} percent complete`}
    >
      <div className="relative h-36 w-36 shrink-0">
        <svg
          className="h-full w-full -rotate-90"
          viewBox="0 0 120 120"
          aria-hidden
        >
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted/30 dark:text-gray-700"
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className={cn(
              "transition-[stroke-dashoffset] duration-500 ease-out",
              percent < 40
                ? "text-amber-500"
                : percent < 80
                  ? "text-sky-500"
                  : "text-emerald-500"
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold tabular-nums text-foreground dark:text-gray-100">
            {percent}%
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            complete
          </span>
        </div>
      </div>
      <p className="max-w-sm text-center text-base font-medium leading-relaxed text-foreground dark:text-gray-100">
        {percent === 100 ? (
          <>Profile complete — you&apos;re set to win more jobs.</>
        ) : (
          <>
            {message ? <>{message}</> : <>Finish your profile to build trust.</>}
          </>
        )}
      </p>
    </div>
  );
}
