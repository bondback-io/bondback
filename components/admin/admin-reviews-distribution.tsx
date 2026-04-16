import type { StarDistribution } from "@/lib/admin/admin-reviews-stats";

type AdminReviewsDistributionProps = {
  distribution: StarDistribution;
  total: number;
  className?: string;
};

export function AdminReviewsDistribution({
  distribution,
  total,
  className,
}: AdminReviewsDistributionProps) {
  const max = Math.max(1, ...Object.values(distribution));

  return (
    <div className={className}>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
        Star distribution
      </p>
      <ul className="space-y-2">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = distribution[star];
          const pct = Math.round((count / max) * 100);
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={star} className="flex items-center gap-2 text-sm">
              <span className="w-16 shrink-0 tabular-nums text-muted-foreground dark:text-gray-400">
                {star}★
              </span>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-amber-500/90 dark:bg-amber-500/80"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right tabular-nums text-foreground dark:text-gray-200">
                {count}
              </span>
              <span className="hidden w-10 shrink-0 text-right text-[11px] text-muted-foreground sm:inline dark:text-gray-500">
                {share}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
