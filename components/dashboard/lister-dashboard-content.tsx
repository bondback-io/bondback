import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  DashboardStickyHeader,
  QuickStatsRow,
  QuickActionsRow,
  CollapsibleActivityFeed,
  DashboardEmptyState,
} from "@/components/dashboard";
import { DashboardListingCardWithSwipe } from "@/components/dashboard/dashboard-cards-swipe";
import { ChevronDown } from "lucide-react";
import { listingTitleWithoutSuburbSuffix, type ListingRow } from "@/lib/listings";
import { resolvePlatformFeePercent } from "@/lib/platform-fee";
import { detailUrlForCardItem } from "@/lib/navigation/listing-or-job-href";

type JobRow = {
  id: number;
  listing_id: string;
  status: string;
  updated_at?: string | null;
  winner_id?: string | null;
};

export type CancelledDashboardRow =
  | { kind: "job"; id: string; cancelledAt: string; job: JobRow }
  | { kind: "listing"; id: string; cancelledAt: string; listing: ListingRow };

export type ListerDashboardContentProps = {
  liveListings: ListingRow[];
  activeJobs: JobRow[];
  /** Merged cancelled jobs + listings ended early (no job row); sorted by date. */
  cancelledRows: CancelledDashboardRow[];
  totalCancelledItems: number;
  listingMap: Map<string, ListingRow>;
  stats: { label: string; value: string | number }[];
  activityItems: {
    id: string;
    type: string;
    message_text: string | null;
    job_id: number | null;
    created_at: string;
    href?: string | null;
  }[];
  bidCountByListingId: Record<string, number>;
  nowMs: number;
  oneDayMs: number;
  parseUtcTimestamp: (s: string) => number;
  feePercentage: number;
  sessionPayload: {
    user: { id: string; email?: string };
    profile: { full_name: string | null; roles: string[]; activeRole: string; profile_photo_url: string | null };
    roles: string[];
    activeRole: string;
    isAdmin?: boolean;
  };
};

const LISTER_ACTIONS = [
  {
    label: "Create New Listing",
    href: "/listings/new",
    primary: true,
    icon: "plus" as const,
    useCreateListingPicker: true,
  },
  { label: "Browse Cleaners", href: "/cleaners", icon: "search" as const },
  { label: "My Active Jobs", href: "/lister/dashboard#active-jobs", icon: "briefcase" as const },
  { label: "My Completed Jobs", href: "/lister/dashboard#completed-jobs", icon: "check-circle" as const },
];

export function ListerDashboardContent({
  liveListings,
  activeJobs,
  cancelledRows,
  totalCancelledItems,
  listingMap,
  stats,
  activityItems,
  bidCountByListingId,
  nowMs,
  oneDayMs,
  parseUtcTimestamp,
  feePercentage,
  sessionPayload,
}: ListerDashboardContentProps) {
  return (
    <>
      <DashboardStickyHeader
        title="Lister Dashboard"
        roleLabel="Lister"
        role="lister"
      />
      <QuickStatsRow stats={stats} scrollOnMobile />
      <div className="hidden sm:block">
        <QuickActionsRow actions={LISTER_ACTIONS} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground dark:text-gray-100">
            My Active Listings
          </h2>
          {liveListings.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {liveListings.length} live
            </Badge>
          )}
        </div>
        {liveListings.length === 0 ? (
          <DashboardEmptyState
            title="No listings yet"
            description="Create a listing to get bids from cleaners."
            actionLabel="Create your first listing"
            actionHref="/listings/new"
            useCreateListingPicker
            icon="list"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveListings.map((listing) => {
              const endMs = parseUtcTimestamp(listing.end_time);
              const isUrgent = endMs > nowMs && endMs - nowMs < oneDayMs;
              return (
                <DashboardListingCardWithSwipe
                  key={listing.id}
                  listing={listing}
                  bidCount={bidCountByListingId[String(listing.id)] ?? 0}
                  isUrgent={isUrgent}
                  feePercentage={resolvePlatformFeePercent(
                    listing.platform_fee_percentage,
                    feePercentage
                  )}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 lg:col-span-1">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-foreground dark:text-gray-100">
              Active Jobs
            </h2>
            {activeJobs.length > 0 && (
              <Link href="/my-listings?tab=active" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                View all
              </Link>
            )}
          </div>
          <div className="p-3">
            {activeJobs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground dark:text-gray-400">
                No active jobs.
              </p>
            ) : (
              <ul className="space-y-1">
                {activeJobs.slice(0, 5).map((job) => {
                  const listing = listingMap.get(String(job.listing_id));
                  const href = detailUrlForCardItem({
                    id: job.id,
                    listing_id: job.listing_id,
                    status: job.status,
                    winner_id: job.winner_id,
                  });
                  return (
                    <li key={job.id}>
                      <Link
                        href={href}
                        className="block rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 dark:hover:bg-gray-800/50"
                      >
                        <span className="font-medium text-foreground dark:text-gray-100">
                          {listingTitleWithoutSuburbSuffix(
                            listing?.title ?? `Job #${job.id}`,
                            listing?.suburb
                          )}
                        </span>
                        <span className="ml-1 text-muted-foreground dark:text-gray-400">· View</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="lg:col-span-2">
          <CollapsibleActivityFeed
            items={activityItems}
            viewAllHref="/notifications"
            emptyMessage="Bids, job updates and payments will appear here."
          />
        </div>
      </div>

      <details className="group rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:rounded-xl md:border">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="border-b border-border px-5 py-4 dark:border-gray-800 md:px-4 md:py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground dark:text-gray-100 md:text-sm md:font-semibold">
                    Cancelled listings / jobs
                  </h2>
                  {totalCancelledItems > 0 && (
                    <Badge variant="secondary" className="px-2.5 py-0.5 text-sm md:text-xs">
                      {totalCancelledItems}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm leading-snug text-muted-foreground dark:text-gray-400 md:text-xs">
                  For your records — listings you ended early or jobs you cancelled after assignment. Tap to expand
                  and view the list.
                </p>
              </div>
              <ChevronDown
                className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 md:h-4 md:w-4"
                aria-hidden
              />
            </div>
          </div>
        </summary>
        <div className="p-4 md:p-3">
          {totalCancelledItems === 0 ? (
            <p className="py-4 text-center text-base text-muted-foreground dark:text-gray-400 md:py-3 md:text-sm">
              No cancelled listings or jobs yet. Items you cancel appear here for history.
            </p>
          ) : (
            <ul className="space-y-2">
              {cancelledRows.map((row) => {
                if (row.kind === "job") {
                  const { job } = row;
                  const listing = listingMap.get(String(job.listing_id));
                  const jobRow = job as { updated_at?: string | null };
                  const cancelledAt = jobRow.updated_at
                    ? format(new Date(jobRow.updated_at), "d MMM yyyy")
                    : null;
                  const jobHref = detailUrlForCardItem({
                    id: job.id,
                    listing_id: job.listing_id,
                    status: job.status,
                    winner_id: job.winner_id,
                  });
                  return (
                    <li key={row.id}>
                      <Link
                        href={jobHref}
                        className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/50 dark:border-gray-800 dark:hover:bg-gray-800/50 md:min-h-12"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-base font-semibold text-foreground dark:text-gray-100 md:line-clamp-1">
                            {listingTitleWithoutSuburbSuffix(
                              listing?.title ?? `Job #${job.id}`,
                              listing?.suburb
                            )}
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground dark:text-gray-400">
                            Job cancelled by you
                            {cancelledAt && ` · ${cancelledAt}`} · Un-assigned
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-primary">View →</span>
                      </Link>
                    </li>
                  );
                }
                const { listing } = row;
                const cancelledAt = row.cancelledAt
                  ? format(new Date(row.cancelledAt), "d MMM yyyy")
                  : null;
                const listingHref = detailUrlForCardItem({
                  id: listing.id,
                  status: listing.status,
                });
                return (
                  <li key={row.id}>
                    <Link
                      href={listingHref}
                      className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/50 dark:border-gray-800 dark:hover:bg-gray-800/50 md:min-h-12"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-base font-semibold text-foreground dark:text-gray-100 md:line-clamp-1">
                          {listingTitleWithoutSuburbSuffix(listing.title, listing.suburb)}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground dark:text-gray-400">
                          Listing ended early (auction cancelled)
                          {cancelledAt && ` · ${cancelledAt}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-primary">View →</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>
    </>
  );
}
