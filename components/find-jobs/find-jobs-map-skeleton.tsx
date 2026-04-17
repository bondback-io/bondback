import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const sk = "bg-muted/75 dark:bg-gray-700/80";

/**
 * Rich placeholder for the Leaflet map panel (Find Jobs split layout).
 * Mimics the real overlay (radius chip + map body) so the right column never looks empty.
 */
export function FindJobsMapPaneSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-[280px] w-full flex-col overflow-hidden bg-muted/35 dark:bg-gray-900/55",
        className
      )}
      aria-hidden
    >
      <div className="pointer-events-none absolute left-3 top-3 z-[1] flex flex-col gap-1 rounded-lg bg-background/85 px-2.5 py-1.5 shadow-sm ring-1 ring-border backdrop-blur dark:bg-gray-950/90 dark:ring-gray-800">
        <Skeleton className={cn("h-3 w-28 animate-shimmer", sk)} />
        <Skeleton className={cn("h-2.5 w-20 animate-shimmer opacity-80", sk)} />
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 bg-muted/50 dark:bg-gray-800/40" />
        <Skeleton className="absolute inset-0 rounded-none opacity-40 animate-shimmer dark:opacity-30" />
        <div
          className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18]"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
            `,
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute inset-[12%] rounded-full border-2 border-dashed border-emerald-500/25 dark:border-emerald-400/20" />
        <div className="absolute left-[18%] top-[38%] flex h-8 w-8 items-center justify-center">
          <Skeleton className="h-3 w-3 rounded-full bg-emerald-500/50 shadow-md ring-2 ring-background dark:bg-emerald-400/45" />
        </div>
        <div className="absolute left-[52%] top-[28%] flex h-8 w-8 items-center justify-center">
          <Skeleton className="h-3 w-3 rounded-full bg-emerald-500/40 shadow-md ring-2 ring-background dark:bg-emerald-400/35" />
        </div>
        <div className="absolute bottom-[32%] right-[22%] flex h-8 w-8 items-center justify-center">
          <Skeleton className="h-3 w-3 rounded-full bg-emerald-500/45 shadow-md ring-2 ring-background dark:bg-emerald-400/40" />
        </div>
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
          <Skeleton className={cn("h-8 w-36 rounded-md animate-shimmer", sk)} />
          <Skeleton className={cn("h-2 w-48 max-w-[80%] rounded-full opacity-60", sk)} />
        </div>
      </div>
    </div>
  );
}
