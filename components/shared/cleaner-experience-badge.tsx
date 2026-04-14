import { Badge } from "@/components/ui/badge";
import {
  cleanerExperienceBadgeClassName,
  cleanerExperienceLabel,
} from "@/lib/cleaner-experience-tier";
import { cn } from "@/lib/utils";

/** Experience label from completed Bond Back jobs (winner, completed). */
export function CleanerExperienceBadge({
  jobs,
  className,
}: {
  jobs: number;
  className?: string;
}) {
  const n = Math.max(0, Math.floor(Number(jobs) || 0));
  return (
    <Badge
      variant="secondary"
      className={cn(
        "shrink-0 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide",
        cleanerExperienceBadgeClassName(n),
        className
      )}
    >
      {cleanerExperienceLabel(n)}
    </Badge>
  );
}
