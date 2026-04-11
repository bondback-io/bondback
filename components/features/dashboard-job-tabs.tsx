"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ActiveJobCard } from "@/components/features/active-job-card";
import type { ListingRow } from "@/lib/listings";

type JobItem = {
  id: string | number;
  listing_id: string;
  status: string;
  winner_id?: string | null;
  cleaner_id?: string | null;
};

export type DashboardJobTabsProps = {
  jobs: { job: JobItem; listing: ListingRow | null; daysLeft: number | null }[];
  disputedCount: number;
  /** Pre-select Disputed tab when e.g. ?status=disputed */
  defaultTab?: "all" | "active" | "completed" | "disputed";
};

const DISPUTED_STATUSES = ["disputed", "in_review", "dispute_negotiating"];
const ACTIVE_STATUSES = ["accepted", "in_progress"];

function isDisputed(status: string) {
  return DISPUTED_STATUSES.includes(status);
}

export function DashboardJobTabs({
  jobs,
  disputedCount,
  defaultTab = "active",
}: DashboardJobTabsProps) {
  const [value, setValue] = useState<string>(defaultTab);

  const { active, completed, disputed } = useMemo(() => {
    const active = jobs.filter(({ job }) => ACTIVE_STATUSES.includes(job.status));
    const completed = jobs.filter(({ job }) => job.status === "completed");
    const disputed = jobs.filter(({ job }) => isDisputed(job.status));
    return { active, completed, disputed };
  }, [jobs]);

  const filteredJobs =
    value === "all"
      ? jobs
      : value === "active"
        ? active
        : value === "completed"
          ? completed
          : disputed;

  if (jobs.length === 0) {
    return null;
  }

  return (
    <Tabs value={value} onValueChange={setValue} className="w-full">
      <TabsList className="mb-4 flex w-full flex-wrap gap-1 bg-muted/60 dark:bg-gray-800/60">
        <TabsTrigger value="all" className="text-xs sm:text-sm">
          All ({jobs.length})
        </TabsTrigger>
        <TabsTrigger value="active" className="text-xs sm:text-sm">
          Active ({active.length})
        </TabsTrigger>
        <TabsTrigger value="completed" className="text-xs sm:text-sm">
          Completed ({completed.length})
        </TabsTrigger>
        <TabsTrigger value="disputed" className="flex items-center gap-1.5 text-xs sm:text-sm">
          Disputed
          {disputedCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {disputedCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value={value} className="mt-0">
        {filteredJobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center dark:bg-gray-800/30">
            <p className="text-sm font-medium text-foreground dark:text-gray-100">
              {value === "disputed" ? "No disputed jobs" : value === "active" ? "No active jobs" : value === "completed" ? "No completed jobs" : "No jobs"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map(({ job, listing, daysLeft }) => (
              <ActiveJobCard
                key={job.id}
                job={{
                  id: String(job.id),
                  listing_id: job.listing_id,
                  status: job.status,
                  winner_id: job.winner_id,
                  cleaner_id: job.cleaner_id,
                }}
                listing={listing}
                daysLeft={daysLeft}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
