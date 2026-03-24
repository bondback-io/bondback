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
import { Briefcase, XCircle, ChevronDown } from "lucide-react";
import type { ListingRow } from "@/lib/listings";

type JobRow = {
  id: number;
  listing_id: string;
  status: string;
  cleaner_confirmed_complete?: boolean | null;
  updated_at?: string | null;
};

export type CleanerDashboardContentProps = {
  activeJobs: JobRow[];
  cancelledJobs: JobRow[];
  listingsMap: Map<string, ListingRow>;
  stats: { label: string; value: string | number }[];
  activityItems: { id: string; type: string; message_text: string | null; job_id: number | null; created_at: string }[];
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
              const moveOutDate = listing?.move_out_date;
              const moveOut =
                moveOutDate != null && moveOutDate !== ""
                  ? new Date(moveOutDate)
                  : null;
              const daysLeft =
                moveOut != null
                  ? Math.max(
                      0,
                      Math.ceil(
                        (moveOut.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
                      )
                    )
                  : null;
              const isUrgent = daysLeft != null && daysLeft <= 1;
              return (
                <DashboardJobCardWithSwipe
                  key={job.id}
                  job={{
                    id: job.id,
                    listing_id: job.listing_id,
                    status: job.status,
                    cleaner_confirmed_complete: job.cleaner_confirmed_complete,
                  }}
                  listing={listing}
                  daysLeft={daysLeft}
                  isUrgent={isUrgent}
                />
              );
            })}
          </div>
        )}
      </div>

      <CollapsibleActivityFeed
        items={activityItems}
        viewAllHref="/notifications"
        emptyMessage="Job updates and payments will appear here."
      />

      <details className="group rounded-xl border border-border bg-card dark:border-gray-800 dark:bg-gray-900/50">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground dark:text-gray-200 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            Cancelled jobs
            {cancelledJobs.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {cancelledJobs.length}
              </Badge>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-4 py-3 dark:border-gray-800">
          {cancelledJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              When a lister cancels a job you were assigned to, it will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {cancelledJobs.map((job) => {
                const listing = listingsMap.get(String(job.listing_id));
                const cancelledAt = job.updated_at
                  ? format(new Date(job.updated_at), "d MMM yyyy")
                  : null;
                return (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm transition hover:bg-muted/50 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:bg-gray-800/70"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground dark:text-gray-100">
                          {listing?.title ?? `Job #${job.id}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                          Cancelled by lister{cancelledAt && ` · ${cancelledAt}`} · Un-assigned
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary">View →</span>
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
