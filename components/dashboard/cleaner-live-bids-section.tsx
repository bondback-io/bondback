import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Gavel, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCents, listingTitleWithoutSuburbSuffix } from "@/lib/listings";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";
import { DashboardEmptyState } from "@/components/dashboard";
import { hrefListingOrJob } from "@/lib/navigation/listing-or-job-href";

export type CleanerLiveBidItem = {
  listingId: string;
  title: string;
  suburb: string;
  postcode: string;
  coverUrl: string | null;
  myBidCents: number;
  currentLowestCents: number;
  endTimeIso: string;
  isLeading: boolean;
  /** Total bids on this listing (all cleaners), for context on the auction. */
  bidCount?: number;
};

export function CleanerLiveBidsSection({ items }: { items: CleanerLiveBidItem[] }) {
  if (items.length === 0) {
    return (
      <DashboardEmptyState
        title="No live bids yet"
        description="When you bid on an open auction, it will show here until the listing ends or is assigned."
        actionLabel="Browse open jobs"
        actionHref="/jobs"
        icon="list"
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const endsLabel = (() => {
          try {
            const d = new Date(item.endTimeIso);
            if (Number.isNaN(d.getTime())) return null;
            return formatDistanceToNow(d, { addSuffix: true });
          } catch {
            return null;
          }
        })();

        const detailUrl = hrefListingOrJob(
          {
            id: item.listingId,
            status: "live",
            end_time: item.endTimeIso,
          },
          null
        );
        return (
          <li key={item.listingId}>
            <Link
              href={detailUrl}
              className={cn(
                "flex min-h-[100px] gap-3 rounded-2xl border-2 bg-card p-3 shadow-sm transition-all active:scale-[0.99] sm:min-h-[96px] sm:p-4",
                "no-underline hover:no-underline",
                "hover:border-emerald-500/40 hover:shadow-md dark:bg-gray-950/60",
                item.isLeading
                  ? "border-emerald-200/90 ring-1 ring-emerald-500/15 dark:border-emerald-800/70 dark:ring-emerald-500/10"
                  : "border-border dark:border-gray-800"
              )}
            >
              <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border border-border bg-muted dark:border-gray-800 sm:h-24 sm:w-24">
                <OptimizedImage
                  src={item.coverUrl ?? "/placeholder-listing.png"}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 96px, 96px"
                  className="object-cover"
                  containerClassName="absolute inset-0 size-full"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Gavel className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                    <Badge
                      variant="secondary"
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:text-xs",
                        item.isLeading
                          ? "border-emerald-300/80 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-200"
                          : "border-amber-200/90 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
                      )}
                    >
                      {item.isLeading ? "You're leading" : "Outbid"}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-base font-bold leading-snug text-foreground dark:text-gray-50">
                    {listingTitleWithoutSuburbSuffix(item.title, item.suburb)}
                  </p>
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    {[item.suburb, item.postcode].filter(Boolean).join(" ")}
                  </p>
                  {item.bidCount != null && (
                    <p
                      className={cn(
                        "mt-0.5 text-[11px] tabular-nums text-muted-foreground dark:text-gray-500",
                        item.bidCount > 0 && "font-medium text-foreground/75 dark:text-gray-400"
                      )}
                    >
                      {item.bidCount === 0 ? (
                        "No bids yet"
                      ) : (
                        <>
                          {item.bidCount} bid{item.bidCount !== 1 ? "s" : ""} on this auction
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-end justify-between gap-2 border-t border-border/60 pt-2 dark:border-gray-800">
                  <div className="min-w-0 space-y-0.5 text-sm">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-500">
                      Your bid
                    </p>
                    <p className="font-semibold tabular-nums text-foreground dark:text-gray-100">
                      {formatCents(item.myBidCents)}
                    </p>
                    <p className="text-[11px] text-muted-foreground dark:text-gray-500">
                      Lowest:{" "}
                      <span className="font-medium text-foreground dark:text-gray-300">
                        {formatCents(item.currentLowestCents)}
                      </span>
                    </p>
                  </div>
                  {endsLabel && (
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground dark:text-gray-400">
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="text-right">{endsLabel}</span>
                    </div>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  View auction
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
