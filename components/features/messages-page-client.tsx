"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/supabase";
import { JobChat } from "@/components/features/job-chat";
import { isChatUnlockedForJobStatus } from "@/lib/chat-unlock";
import { formatCents } from "@/lib/listings";
import { buildChatStatusPill } from "@/lib/chat-messenger-display";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type Conversation = {
  jobId: number;
  listingId: string | null;
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
  agreedAmountCents: number | null;
  autoReleaseAt: string | null;
  cleanerConfirmedComplete: boolean;
  hasPaymentHold: boolean;
  /** When set, chat is read-only (funds released to cleaner). */
  paymentReleasedAt: string | null;
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

        const jr = job as JobRow & {
          agreed_amount_cents?: number | null;
          auto_release_at?: string | null;
          cleaner_confirmed_complete?: boolean | null;
          payment_intent_id?: string | null;
          payment_released_at?: string | null;
        };
        return {
          jobId: job.id as number,
          listingId:
            (job.listing_id != null ? String(job.listing_id) : null) ??
            (listing?.id != null ? String(listing.id) : null),
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
          agreedAmountCents:
            jr.agreed_amount_cents != null && jr.agreed_amount_cents > 0
              ? jr.agreed_amount_cents
              : null,
          autoReleaseAt: jr.auto_release_at ?? null,
          cleanerConfirmedComplete: jr.cleaner_confirmed_complete === true,
          hasPaymentHold: !!jr.payment_intent_id?.trim(),
          paymentReleasedAt: jr.payment_released_at?.trim() ?? null,
        };
      }),
    [jobs, listingById, latestByJob, profileById, currentUserId]
  );

  const activeConvos = conversations.filter(
    (c) =>
      isChatUnlockedForJobStatus(c.jobStatus) && c.jobStatus !== "completed"
  );
  const completedConvos = conversations.filter(
    (c) => c.jobStatus === "completed"
  );

  const selected = conversations.find((c) => c.jobId === selectedJobId) ?? null;

  return (
    <div className="flex flex-col gap-2.5 lg:flex-row lg:gap-3">
      {/* Conversation list — compact, mobile-first */}
      <div className="flex w-full max-h-[min(38vh,300px)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/95 to-white shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-900/95 lg:max-h-none lg:w-[min(100%,19rem)] lg:shrink-0 xl:w-[21rem]">
        <div className="shrink-0 border-b border-slate-200/80 px-3 py-1.5 dark:border-slate-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Chats
          </p>
          <p className="hidden text-[10px] leading-snug text-slate-500 dark:text-slate-500 sm:block">
            Tap a thread to message. Completed jobs are below.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-1.5 py-1.5 sm:px-2">
          {activeConvos.length > 0 && (
            <div className="space-y-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400/90">
                Active
              </p>
              {activeConvos.map((c) => {
                const isSelected = c.jobId === selectedJobId;
                const isCurrentUserLister = currentUserId === c.listerId;
                const isCurrentUserCleaner = currentUserId === c.cleanerId;

                let titleLine: string;
                if (isCurrentUserCleaner) {
                  const name = c.listerName ?? c.otherPartyName ?? "Owner";
                  titleLine = `${name}`;
                } else if (isCurrentUserLister) {
                  const name = c.cleanerName ?? c.otherPartyName ?? "Cleaner";
                  titleLine = `${name}`;
                } else {
                  titleLine = c.listingTitle ?? "Bond clean job";
                }

                const roleLabel =
                  isCurrentUserCleaner ? "Owner" : isCurrentUserLister ? "Cleaner" : "";

                const baseTitle = c.listingTitle ?? "Bond clean job";
                const jobLine = baseTitle.split(" in ")[0] ?? baseTitle;
                const loc =
                  c.listingSuburb || c.listingPostcode
                    ? `${c.listingSuburb ?? ""} ${c.listingPostcode ?? ""}`.trim()
                    : null;

                let relativeLabel: string | null = null;
                if (c.lastMessageAt) {
                  const d = new Date(c.lastMessageAt);
                  const diffMs = Date.now() - d.getTime();
                  const diffMin = Math.floor(diffMs / 60000);
                  if (diffMin < 1) relativeLabel = "now";
                  else if (diffMin < 60) relativeLabel = `${diffMin}m`;
                  else if (diffMin < 60 * 24) {
                    const h = Math.floor(diffMin / 60);
                    relativeLabel = `${h}h`;
                  } else {
                    const days = Math.floor(diffMin / (60 * 24));
                    relativeLabel = `${days}d`;
                  }
                }

                const initial = (titleLine.trim().charAt(0) || "?").toUpperCase();
                const jobHref = `/jobs/${c.jobId}`;

                return (
                  <div
                    key={c.jobId}
                    className={cn(
                      "overflow-hidden rounded-lg border transition",
                      isSelected
                        ? "border-sky-400/80 bg-sky-50 dark:border-sky-500/50 dark:bg-sky-950/50"
                        : "border-transparent bg-white/50 hover:bg-slate-100/90 dark:bg-transparent dark:hover:bg-slate-800/70"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedJobId(c.jobId)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm sm:h-9 sm:w-9 sm:text-[11px]",
                          isSelected
                            ? "bg-gradient-to-br from-sky-500 to-blue-600"
                            : "bg-gradient-to-br from-slate-400 to-slate-600 dark:from-slate-500 dark:to-slate-700"
                        )}
                        aria-hidden
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="truncate text-[12px] font-semibold leading-tight text-slate-900 dark:text-slate-100 sm:text-[13px]">
                            {titleLine}
                            {roleLabel ? (
                              <span className="font-normal text-slate-500 dark:text-slate-400">
                                {" "}
                                · {roleLabel}
                              </span>
                            ) : null}
                          </p>
                          {relativeLabel && (
                            <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                              {relativeLabel}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[10px] text-slate-600 dark:text-slate-400 sm:text-[11px]">{jobLine}</p>
                        {loc && (
                          <p className="truncate text-[9px] text-slate-400 dark:text-slate-500 sm:text-[10px]">{loc}</p>
                        )}
                        {c.lastMessageText && (
                          <p className="mt-0.5 line-clamp-1 text-[10px] italic text-slate-500 dark:text-slate-400">
                            {c.lastMessageText}
                          </p>
                        )}
                      </div>
                    </button>
                    <Link
                      href={jobHref}
                      className={cn(
                        "flex min-h-[40px] touch-manipulation items-center justify-center border-t px-2 py-1.5 text-[11px] font-semibold no-underline transition active:bg-black/[0.04] dark:active:bg-white/[0.06]",
                        isCurrentUserLister
                          ? "border-sky-200/80 bg-sky-100/60 text-sky-800 hover:bg-sky-100 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/70"
                          : "border-emerald-200/80 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100/80 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50"
                      )}
                    >
                      View job
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {completedConvos.length > 0 && (
            <div className={cn("mt-2", activeConvos.length > 0 && "border-t border-slate-200/80 pt-2 dark:border-slate-800")}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
                  <span>History</span>
                  <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {completedConvos.length}
                  </span>
                </summary>
                <div className="mt-1 space-y-1">
                  {completedConvos.map((c) => {
                    const isSelected = c.jobId === selectedJobId;
                    const initial = (c.listingTitle ?? "J").trim().charAt(0).toUpperCase();
                    return (
                      <button
                        key={c.jobId}
                        type="button"
                        onClick={() => setSelectedJobId(c.jobId)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition",
                          isSelected
                            ? "border-violet-400/60 bg-violet-50/90 dark:border-violet-500/40 dark:bg-violet-950/20"
                            : "border-transparent hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-[10px] font-bold text-white dark:from-slate-600 dark:to-slate-800"
                          aria-hidden
                        >
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-100">
                            {c.listingTitle ?? "Bond clean job"}
                          </p>
                          <p className="truncate text-[10px] text-slate-500 dark:text-slate-500">
                            Done · {c.listingSuburb} {c.listingPostcode}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* Right: chat window */}
      <div className="min-w-0 flex-1">
        {!selected ? (
          <Card className="flex h-[360px] items-center justify-center text-xs text-muted-foreground sm:h-[400px]">
            <p>Select a job from the left to view messages.</p>
          </Card>
        ) : (
          <JobChat
            jobId={selected.jobId}
            currentUserId={currentUserId}
            canChat={isChatUnlockedForJobStatus(selected.jobStatus)}
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
            messenger={{
              jobTitle: selected.listingTitle ?? "Bond clean job",
              agreedPriceLabel:
                selected.agreedAmountCents != null && selected.agreedAmountCents > 0
                  ? formatCents(selected.agreedAmountCents)
                  : "—",
              statusPillLabel: buildChatStatusPill({
                status: selected.jobStatus,
                hasPaymentHold: selected.hasPaymentHold,
                autoReleaseAt: selected.autoReleaseAt,
              }),
            }}
            paymentReleasedAt={selected.paymentReleasedAt}
          />
        )}
      </div>
    </div>
  );
}

