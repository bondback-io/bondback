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
import { DashboardJobCardWithSwipe } from "@/components/dashboard/dashboard-cards-swipe";
import { Briefcase, ChevronDown } from "lucide-react";
import {
  getPreferredCleaningDeadlineMs,
  daysUntilPreferredCleaningDeadline,
  listingTitleWithoutSuburbSuffix,
  type ListingRow,
} from "@/lib/listings";
import { detailUrlForCardItem } from "@/lib/navigation/listing-or-job-href";

type JobRow = {
  id: number;
  listing_id: string;
  status: string;
  winner_id?: string | null;
  cleaner_confirmed_complete?: boolean | null;
  updated_at?: string | null;
};

export type CleanerDashboardContentProps = {
  activeJobs: JobRow[];
  cancelledJobs: JobRow[];
  listingsMap: Map<string, ListingRow>;
  stats: { label: string; value: string | number }[];
  activityItems: {
    id: string;
    type: string;
    message_text: string | null;
    job_id: number | null;
    created_at: string;
    href?: string | null;
  }[];
  now: Date;
  sessionPayload: {
    user: { id: string; email?: string };
    profile: { full_name: string | null; roles: string[]; activeRole: string; profile_photo_url: string | null };
    roles: string[];
    activeRole: string;
    isAdmin?: boolean;
  };
};

const CLEANER_ACTIONS = [
  { label: "Browse Available Jobs", href: "/jobs", primary: true, icon: "search" as const },
  { label: "Live bids", href: "/cleaner/dashboard#live-bids", icon: "gavel" as const },
  { label: "Browse cleaners", href: "/cleaners", icon: "list" as const },
  { label: "My Active Jobs", href: "/cleaner/dashboard#active-jobs", icon: "briefcase" as const },
  { label: "My Earnings", href: "/earnings", icon: "dollar-sign" as const },
];

export function CleanerDashboardContent({
  activeJobs,
  cancelledJobs,
  listingsMap,
  stats,
  activityItems,
  now,
  sessionPayload,
}: CleanerDashboardContentProps) {
  return (
    <>
      <DashboardStickyHeader
        title="Cleaner Dashboard"
        roleLabel="Cleaner"
        role="cleaner"
      />
      <QuickStatsRow stats={stats} scrollOnMobile />
      <div className="hidden sm:block">
        <QuickActionsRow actions={CLEANER_ACTIONS} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground dark:text-gray-100">
            My Active Jobs
          </h2>
          {activeJobs.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeJobs.length} active
            </Badge>
          )}
        </div>
        {activeJobs.length === 0 ? (
          <DashboardEmptyState
            title="No active jobs"
            description="Browse available bond clean jobs and place a bid."
            actionLabel="Browse available jobs"
            actionHref="/jobs"
            icon="briefcase"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeJobs.map((job) => {
              const listing = listingsMap.get(String(job.listing_id)) ?? null;
              const deadlineMs = listing
                ? getPreferredCleaningDeadlineMs(listing)
                : null;
              const daysLeft =
                (job.status === "accepted" || job.status === "in_progress") &&
                deadlineMs != null
                  ? daysUntilPreferredCleaningDeadline(deadlineMs, now)
                  : null;
              return (
                <DashboardJobCardWithSwipe
                  key={job.id}
                  job={{
                    id: job.id,
                    listing_id: job.listing_id,
                    status: job.status,
                    winner_id: job.winner_id,
                    cleaner_confirmed_complete: job.cleaner_confirmed_complete,
                  }}
                  listing={listing}
                  daysLeft={daysLeft}
                />
              );
            })}
          </div>
        )}
      </div>

      <details className="group rounded-2xl border-2 border-border bg-card dark:border-gray-800 dark:bg-gray-900/50 md:rounded-xl md:border">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="border-b border-border px-5 py-4 dark:border-gray-800 md:px-4 md:py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground dark:text-gray-100 md:text-sm md:font-semibold">
                    Cancelled jobs
                  </h2>
                  {cancelledJobs.length > 0 && (
                    <Badge variant="secondary" className="px-2.5 py-0.5 text-sm md:text-xs">
                      {cancelledJobs.length}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm leading-snug text-muted-foreground dark:text-gray-400 md:text-xs">
                  For your records only — jobs a lister cancelled after you were assigned. Tap to expand and
                  view the list.
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
          {cancelledJobs.length === 0 ? (
            <p className="py-4 text-center text-base text-muted-foreground dark:text-gray-400 md:py-3 md:text-sm">
              No cancelled jobs. When a lister cancels a job you were assigned to, it will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {cancelledJobs.map((job) => {
                const listing = listingsMap.get(String(job.listing_id));
                const cancelledAt = job.updated_at
                  ? format(new Date(job.updated_at), "d MMM yyyy")
                  : null;
                const jobHref = detailUrlForCardItem({
                  id: job.id,
                  listing_id: job.listing_id,
                  status: job.status,
                  winner_id: job.winner_id,
                });
                return (
                  <li key={job.id}>
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
                          Cancelled by lister{cancelledAt && ` · ${cancelledAt}`} · Un-assigned
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

      <CollapsibleActivityFeed
        items={activityItems}
        viewAllHref="/notifications"
        emptyMessage="Job updates and payments will appear here."
      />
    </>
  );
}
