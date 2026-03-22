"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/supabase";
import { JobChat } from "@/components/features/job-chat";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type Conversation = {
  jobId: number;
  jobStatus: string | null;
  listingTitle: string | null;
  listingSuburb: string | null;
  listingPostcode: string | null;
  otherPartyName: string | null;
  otherPartyRole: "cleaner" | "lister";
  listerId: string | null;
  cleanerId: string | null;
  listerName: string | null;
  cleanerName: string | null;
  listerAvatarUrl: string | null;
  cleanerAvatarUrl: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
};

type MessagesPageClientProps = {
  currentUserId: string;
  jobs: JobRow[];
  listings: ListingRow[];
  messages: JobMessageRow[];
  profiles: ProfileRow[];
};

export function MessagesPageClient({
  currentUserId,
  jobs,
  listings,
  messages,
  profiles,
}: MessagesPageClientProps) {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(() => {
    const firstActive = jobs.find((j) => j.status === "in_progress");
    return (firstActive?.id as number | undefined) ?? (jobs[0]?.id as number);
  });

  const listingById = useMemo(() => {
    const map = new Map<string | number, ListingRow>();
    listings.forEach((l) => map.set(l.id as string | number, l));
    return map;
  }, [listings]);

  const profileById = useMemo(() => {
    const map = new Map<string, ProfileRow>();
    profiles.forEach((p) => map.set(p.id as string, p));
    return map;
  }, [profiles]);

  const latestByJob: Record<number, JobMessageRow | undefined> = useMemo(() => {
    const map: Record<number, JobMessageRow | undefined> = {};
    for (const m of messages) {
      if (!map[m.job_id]) {
        map[m.job_id] = m;
      }
    }
    return map;
  }, [messages]);

  const conversations: Conversation[] = useMemo(
    () =>
      jobs.map((job) => {
        const listing = listingById.get(job.listing_id as string | number);
        const latest = latestByJob[job.id as number];

        const isLister = currentUserId === job.lister_id;
        const otherPartyRole = isLister ? "cleaner" : "lister";
        const listerProfile = job.lister_id
          ? profileById.get(job.lister_id as string)
          : null;
        const cleanerProfile = job.winner_id
          ? profileById.get(job.winner_id as string)
          : null;

        return {
          jobId: job.id as number,
          jobStatus: job.status ?? null,
          listingTitle: listing?.title ?? null,
          listingSuburb: listing?.suburb ?? null,
          listingPostcode: listing?.postcode ?? null,
          otherPartyName:
            otherPartyRole === "cleaner"
              ? (cleanerProfile?.full_name as string | null) ?? "Cleaner"
              : (listerProfile?.full_name as string | null) ?? "Owner",
          otherPartyRole,
          listerId: job.lister_id as string | null,
          cleanerId: job.winner_id as string | null,
          listerName: (listerProfile?.full_name as string | null) ?? null,
          cleanerName: (cleanerProfile?.full_name as string | null) ?? null,
          listerAvatarUrl:
            (listerProfile as any)?.profile_photo_url ?? null,
          cleanerAvatarUrl:
            (cleanerProfile as any)?.profile_photo_url ?? null,
          lastMessageText: latest?.message_text ?? null,
          lastMessageAt: latest?.created_at ?? null,
        };
      }),
    [jobs, listingById, latestByJob, profileById, currentUserId]
  );

  const activeConvos = conversations.filter(
    (c) => c.jobStatus === "in_progress"
  );
  const completedConvos = conversations.filter(
    (c) => c.jobStatus === "completed"
  );

  const selected = conversations.find((c) => c.jobId === selectedJobId) ?? null;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      {/* Left: conversation list */}
      <div className="w-full md:w-1/3 lg:w-2/5 space-y-3">
        <div className="rounded-md border border-border bg-background/70 p-3 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-300">
            Conversations
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground dark:text-gray-400">
            Select a job to view your messages. Completed jobs are shown below
            for history only.
          </p>
        </div>

        {activeConvos.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Active chats
            </p>
            {activeConvos.map((c) => {
              const isSelected = c.jobId === selectedJobId;
              const isCurrentUserLister = currentUserId === c.listerId;
              const isCurrentUserCleaner = currentUserId === c.cleanerId;

              // Title line: counterparty full name + role label
              let titleLine: string;
              if (isCurrentUserCleaner) {
                // You are the cleaner → show lister as Owner
                const name = c.listerName ?? c.otherPartyName ?? "Owner";
                titleLine = `${name} (Owner)`;
              } else if (isCurrentUserLister) {
                // You are the lister/owner → show cleaner
                const name = c.cleanerName ?? c.otherPartyName ?? "Cleaner";
                titleLine = `${name} (Cleaner)`;
              } else {
                // Fallback (shouldn't normally happen)
                titleLine = c.listingTitle ?? "Bond clean job";
              }

              // Subtitle 1: compact job summary (e.g. 2 Bedrooms + 1 Bathroom House), no suburb/postcode
              const baseTitle = c.listingTitle ?? "Bond clean job";
              const secondLine = baseTitle.split(" in ")[0] ?? baseTitle;

              // Subtitle 2: suburb + postcode on its own line
              const thirdLine =
                c.listingSuburb || c.listingPostcode
                  ? `${c.listingSuburb ?? ""} ${c.listingPostcode ?? ""}`.trim()
                  : null;

              let relativeLabel: string | null = null;
              if (c.lastMessageAt) {
                const d = new Date(c.lastMessageAt);
                const diffMs = Date.now() - d.getTime();
                const diffMin = Math.floor(diffMs / 60000);
                if (diffMin < 1) {
                  relativeLabel = "Just now";
                } else if (diffMin < 60) {
                  relativeLabel = `${diffMin} min ago`;
                } else if (diffMin < 60 * 24) {
                  const h = Math.floor(diffMin / 60);
                  relativeLabel = `${h} hr${h === 1 ? "" : "s"} ago`;
                } else {
                  const days = Math.floor(diffMin / (60 * 24));
                  relativeLabel = `${days} day${days === 1 ? "" : "s"} ago`;
                }
              }

              // Simple progress: 1/5 accepted, 2/5 in progress, 5/5 completed
              let progressLabel: string | null = null;
              if (c.jobStatus === "accepted") {
                progressLabel = "1/5";
              } else if (c.jobStatus === "in_progress") {
                progressLabel = "2/5";
              } else if (c.jobStatus === "completed") {
                progressLabel = "5/5";
              }

              return (
                <button
                  key={c.jobId}
                  type="button"
                  onClick={() => setSelectedJobId(c.jobId)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${
                    isSelected
                      ? "border-emerald-400 bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-900/40 dark:text-gray-100"
                      : "border-border bg-background/80 hover:bg-muted/70 dark:border-gray-600 dark:bg-gray-800/90 dark:hover:bg-gray-700/90 dark:text-gray-100"
                  }`}
                >
                  <p className="line-clamp-1 text-[13px] font-semibold text-foreground dark:text-gray-100">
                    {titleLine}
                  </p>
                  {secondLine && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground dark:text-gray-300">
                      {secondLine}
                    </p>
                  )}
                  {thirdLine && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground dark:text-gray-300">
                      {thirdLine}
                    </p>
                  )}
                  {progressLabel && (
                    <p className="mt-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-600 dark:text-emerald-300">
                      Job progress: {progressLabel}
                    </p>
                  )}
                  {relativeLabel && (
                    <p className="mt-0.5 text-[10px] font-medium italic text-emerald-700 dark:text-emerald-600 dark:text-emerald-300">
                      Last message · {relativeLabel}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {completedConvos.length > 0 && (
          <div className="pt-3">
            <details className="space-y-1">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-gray-300">
                Completed chats ({completedConvos.length})
              </summary>
              <div className="mt-1 space-y-1">
                {completedConvos.map((c) => {
                  const isSelected = c.jobId === selectedJobId;
                  return (
                    <button
                      key={c.jobId}
                      type="button"
                      onClick={() => setSelectedJobId(c.jobId)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-[11px] transition ${
                        isSelected
                          ? "border-slate-400 bg-slate-50 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-100"
                          : "border-border bg-background/60 hover:bg-muted/70 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:bg-gray-700/70 dark:text-gray-200"
                      }`}
                    >
                      <p className="line-clamp-1 font-medium text-slate-900 dark:text-gray-100">
                        {c.listingTitle ?? "Bond clean job"}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground dark:text-gray-400">
                        Completed · {c.listingSuburb} {c.listingPostcode}
                      </p>
                    </button>
                  );
                })}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Right: chat window */}
      <div className="w-full md:w-2/3 lg:w-3/5">
        {!selected ? (
          <Card className="flex h-[360px] items-center justify-center text-xs text-muted-foreground sm:h-[400px]">
            <p>Select a job from the left to view messages.</p>
          </Card>
        ) : (
          <JobChat
            jobId={selected.jobId}
            currentUserId={currentUserId}
            canChat={selected.jobStatus === "in_progress" || selected.jobStatus === "completed"}
            currentUserRole={
              currentUserId === selected.listerId
                ? "lister"
                : currentUserId === selected.cleanerId
                  ? "cleaner"
                  : null
            }
            listerId={selected.listerId}
            cleanerId={selected.cleanerId}
            listerName={selected.listerName}
            cleanerName={selected.cleanerName}
            listerAvatarUrl={selected.listerAvatarUrl}
            cleanerAvatarUrl={selected.cleanerAvatarUrl}
          />
        )}
      </div>
    </div>
  );
}

