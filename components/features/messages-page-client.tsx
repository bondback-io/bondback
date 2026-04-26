"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn, trimStr } from "@/lib/utils";
import { ACTIVE_ROLE_CHANGED_EVENT } from "@/lib/active-role-events";
import type { Database } from "@/types/supabase";
import { JobChat } from "@/components/features/job-chat";
import { isChatUnlockedForJobStatus } from "@/lib/chat-unlock";
import { formatCents } from "@/lib/listings";
import {
  buildChatStatusPill,
  buildMessengerProfileMap,
  getMessengerProfile,
  isJobListerUser,
  messengerPeerCleanerUsername,
  messengerPeerDisplayName,
} from "@/lib/chat-messenger-display";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function ConversationPickerAvatar({
  photoUrl,
  initial,
  isSelected,
  activeCleanerTheme,
  className,
  size = "default",
}: {
  photoUrl: string | null;
  initial: string;
  isSelected: boolean;
  activeCleanerTheme: boolean;
  /** e.g. `sm:h-9 sm:w-9` for desktop sidebar */
  className?: string;
  size?: "default" | "desktop";
}) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl]);
  const photoSrc = trimStr(photoUrl);
  const showImg = Boolean(photoSrc) && !imgFailed;
  const isDesktop = size === "desktop";
  const px = isDesktop ? 36 : 32;

  if (showImg) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10",
          isDesktop ? "h-9 w-9" : "h-8 w-8",
          isSelected && activeCleanerTheme && "ring-emerald-500/40",
          isSelected && !activeCleanerTheme && "ring-sky-500/40",
          className
        )}
      >
        <OptimizedImage
          src={photoSrc}
          alt=""
          width={px}
          height={px}
          sizes={isDesktop ? "36px" : "32px"}
          quality={75}
          className="h-full w-full rounded-full object-cover"
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        isDesktop ? "h-9 w-9 text-[11px]" : "h-8 w-8 text-[10px]",
        isSelected && activeCleanerTheme
          ? "bg-gradient-to-br from-emerald-500 to-teal-600"
          : isSelected
            ? "bg-gradient-to-br from-sky-500 to-blue-600"
            : "bg-gradient-to-br from-slate-400 to-slate-600 dark:from-slate-600 dark:to-slate-700",
        className
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export type Conversation = {
  jobId: number;
  listingId: string | null;
  jobStatus: string | null;
  listingTitle: string | null;
  listingSuburb: string | null;
  listingState: string | null;
  listingPostcode: string | null;
  otherPartyName: string | null;
  otherPartyRole: "cleaner" | "lister";
  listerId: string | null;
  cleanerId: string | null;
  listerName: string | null;
  cleanerName: string | null;
  /** Resolved sidebar title for the other participant. */
  otherPartyDisplayName: string;
  /** Cleaner marketplace username when the other party is the cleaner (for “(@username)”). */
  otherPartyUsername: string | null;
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

function otherPartyAvatarUrl(c: Conversation): string | null {
  return c.otherPartyRole === "cleaner" ? c.cleanerAvatarUrl : c.listerAvatarUrl;
}

/** Matches `activeConvos` — threads that are not archived as “past” on /messages. */
function firstActiveThreadJobId(jobs: JobRow[]): number | null {
  const j = jobs.find(
    (row) =>
      isChatUnlockedForJobStatus(row.status) && row.status !== "completed"
  );
  return (j?.id as number | undefined) ?? null;
}

type MessagesPageClientProps = {
  currentUserId: string;
  /** profiles.active_role — chat lister/cleaner labels when you are both on a job */
  activeAppRole?: "lister" | "cleaner" | null;
  /** Resolved inbox mode (lister-owned jobs vs jobs you won as cleaner) — matches `sendJobMessage` gating. */
  messengerRoleFilter: "lister" | "cleaner";
  jobs: JobRow[];
  listings: ListingRow[];
  messages: JobMessageRow[];
  profiles: ProfileRow[];
};

export function MessagesPageClient({
  currentUserId,
  activeAppRole = null,
  messengerRoleFilter,
  jobs,
  listings,
  messages,
  profiles,
}: MessagesPageClientProps) {
  const router = useRouter();
  const [selectedJobId, setSelectedJobId] = useState<number | null>(() =>
    firstActiveThreadJobId(jobs)
  );

  useEffect(() => {
    const onRole = () => {
      router.refresh();
    };
    window.addEventListener(ACTIVE_ROLE_CHANGED_EVENT, onRole);
    return () => window.removeEventListener(ACTIVE_ROLE_CHANGED_EVENT, onRole);
  }, [router]);

  useEffect(() => {
    const ids = new Set(jobs.map((j) => j.id as number));
    if (selectedJobId != null && !ids.has(selectedJobId)) {
      setSelectedJobId(firstActiveThreadJobId(jobs));
    }
  }, [jobs, selectedJobId]);

  const listingById = useMemo(() => {
    const map = new Map<string | number, ListingRow>();
    listings.forEach((l) => map.set(l.id as string | number, l));
    return map;
  }, [listings]);

  const profileById = useMemo(
    () => buildMessengerProfileMap(profiles as ProfileRow[]),
    [profiles]
  );

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

        const isLister = isJobListerUser(currentUserId, job.lister_id as string | null);
        const otherPartyRole = isLister ? "cleaner" : "lister";
        const listerProfile = getMessengerProfile(profileById, job.lister_id as string | null);
        const cleanerProfile = getMessengerProfile(profileById, job.winner_id as string | null);

        const jr = job as JobRow & {
          agreed_amount_cents?: number | null;
          auto_release_at?: string | null;
          cleaner_confirmed_complete?: boolean | null;
          payment_intent_id?: string | null;
          payment_released_at?: string | null;
        };

        const listerDisplay = messengerPeerDisplayName(listerProfile, "Owner");
        const cleanerDisplay = messengerPeerDisplayName(cleanerProfile, "Cleaner");
        const otherPartyDisplayName =
          otherPartyRole === "cleaner" ? cleanerDisplay : listerDisplay;
        const otherPartyUsername =
          otherPartyRole === "cleaner"
            ? messengerPeerCleanerUsername(cleanerProfile)
            : messengerPeerCleanerUsername(listerProfile);

        return {
          jobId: job.id as number,
          listingId:
            (job.listing_id != null ? String(job.listing_id) : null) ??
            (listing?.id != null ? String(listing.id) : null),
          jobStatus: job.status ?? null,
          listingTitle: listing?.title ?? null,
          listingSuburb: listing?.suburb ?? null,
          listingState: listing?.state ?? null,
          listingPostcode: listing?.postcode ?? null,
          otherPartyName: otherPartyDisplayName,
          otherPartyRole,
          listerId: job.lister_id as string | null,
          cleanerId: job.winner_id as string | null,
          listerName: listerDisplay,
          cleanerName: cleanerDisplay,
          otherPartyDisplayName,
          otherPartyUsername,
          listerAvatarUrl: listerProfile?.profile_photo_url ?? null,
          cleanerAvatarUrl: cleanerProfile?.profile_photo_url ?? null,
          lastMessageText: latest?.message_text ?? null,
          lastMessageAt: latest?.created_at ?? null,
          agreedAmountCents:
            jr.agreed_amount_cents != null && jr.agreed_amount_cents > 0
              ? jr.agreed_amount_cents
              : null,
          autoReleaseAt: jr.auto_release_at ?? null,
          cleanerConfirmedComplete: jr.cleaner_confirmed_complete === true,
          hasPaymentHold: !!trimStr(jr.payment_intent_id),
          paymentReleasedAt:
            jr.payment_released_at == null
              ? null
              : trimStr(jr.payment_released_at) || null,
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

  function threadMeta(c: Conversation) {
    const display = String(c.otherPartyDisplayName ?? "");
    const uname = c.otherPartyUsername;
    const looksUsernameOnly = display.trim().startsWith("@");
    const titleLine =
      uname && !looksUsernameOnly ? `${display} (@${uname})` : display;
    const initial = (
      display.replace(/^@/, "").trim().charAt(0) || "?"
    ).toUpperCase();

    let relativeLabel: string | null = null;
    if (c.lastMessageAt) {
      const d = new Date(c.lastMessageAt);
      const diffMs = Date.now() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) relativeLabel = "now";
      else if (diffMin < 60) relativeLabel = `${diffMin}m`;
      else if (diffMin < 60 * 24) {
        relativeLabel = `${Math.floor(diffMin / 60)}h`;
      } else {
        relativeLabel = `${Math.floor(diffMin / (60 * 24))}d`;
      }
    }

    const isCurrentUserLister = isJobListerUser(currentUserId, c.listerId);
    const activeCleanerTheme = isCurrentUserLister && c.cleanerId != null;

    return {
      titleLine,
      initial,
      relativeLabel,
      activeCleanerTheme,
    };
  }

  const togglePastThread = (jobId: number) => {
    setSelectedJobId((prev) => (prev === jobId ? null : jobId));
  };

  /** Desktop sidebar: richer rows with avatar chips. */
  const historyBlockDesktop = (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
        <span>Past chats</span>
        <span className="rounded-full bg-slate-200/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {completedConvos.length}
        </span>
      </summary>
      <div className="mt-1 space-y-1">
        {completedConvos.map((c) => {
          const isSelected = c.jobId === selectedJobId;
          const initial = trimStr(c.listingTitle ?? "J").charAt(0).toUpperCase();
          return (
            <button
              key={c.jobId}
              type="button"
              onClick={() => togglePastThread(c.jobId)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition",
                isSelected
                  ? "border-violet-400/60 bg-violet-50/90 dark:border-violet-500/40 dark:bg-violet-950/30"
                  : "border-transparent hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
              )}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-[9px] font-bold text-white dark:from-slate-600 dark:to-slate-800"
                aria-hidden
              >
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-slate-800 dark:text-slate-100">
                  {c.listingTitle ?? "Bond clean job"}
                </p>
                <p className="truncate text-[9px] text-slate-500 dark:text-slate-500">
                  {isSelected ? "Tap again to hide" : "Read-only · tap to view"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </details>
  );

  /** Mobile: minimal read-only archive — short list, scroll-contained so it stays above toasts / nav. */
  const historyBlockMobile = (
    <details className="group relative z-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-1 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
        <span className="truncate uppercase tracking-wide text-slate-500 dark:text-slate-500">
          Past chats
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="hidden text-[9px] font-normal normal-case tracking-normal text-slate-400 sm:inline">
            Read-only
          </span>
          <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {completedConvos.length}
          </span>
        </span>
      </summary>
      <div className="mt-1 rounded-md border border-slate-200/70 bg-white/90 dark:border-slate-700/90 dark:bg-slate-950/80">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {completedConvos.map((c) => {
            const isSelected = c.jobId === selectedJobId;
            const label = trimStr(c.listingTitle ?? "Bond clean job");
            return (
              <li key={c.jobId}>
                <button
                  type="button"
                  onClick={() => togglePastThread(c.jobId)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-left transition",
                    isSelected
                      ? "bg-violet-50/95 dark:bg-violet-950/35"
                      : "active:bg-slate-100/90 dark:active:bg-slate-800/60"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[11px] leading-snug text-slate-800 dark:text-slate-100">
                    {label}
                  </span>
                  {isSelected ? (
                    <span className="shrink-0 text-[9px] font-medium text-violet-600 dark:text-violet-300">
                      Hide
                    </span>
                  ) : (
                    <span className="shrink-0 text-[9px] font-medium text-slate-400 dark:text-slate-500">
                      View
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-3",
        "max-lg:h-[calc(100dvh-16.25rem-env(safe-area-inset-bottom,0px))] max-lg:max-h-[calc(100dvh-16.25rem-env(safe-area-inset-bottom,0px))] max-lg:min-h-[min(380px,82dvh)]",
        "lg:min-h-[min(480px,calc(100dvh-12rem))]"
      )}
    >
      {/* Mobile: thread picker + past chats (height-capped + internal scroll so chat panel + toasts aren’t crowded) */}
      <div className="flex min-h-0 max-h-[min(46dvh,320px)] shrink-0 flex-col lg:hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-xl border border-slate-200/90 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="min-h-0 shrink-0 px-2 pb-1 pt-1.5">
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Chats
            </p>
          </div>
          {activeConvos.length === 0 ? (
            <p className="px-2 pb-2 text-[11px] text-slate-500 dark:text-slate-400">
              No active conversations.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 px-2 pb-2">
              {activeConvos.map((c) => {
                const isSelected = c.jobId === selectedJobId;
                const { titleLine, initial, relativeLabel, activeCleanerTheme } = threadMeta(c);
                const loc =
                  c.listingSuburb || c.listingPostcode
                    ? `${c.listingSuburb ?? ""} ${c.listingPostcode ?? ""}`.trim()
                    : null;
                return (
                  <li key={c.jobId}>
                    <button
                      type="button"
                      onClick={() => setSelectedJobId(c.jobId)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-xl border px-2 py-1.5 text-left transition active:scale-[0.99]",
                        isSelected && activeCleanerTheme
                          ? "border-emerald-400/90 bg-emerald-50 shadow-sm dark:border-emerald-500/50 dark:bg-emerald-950/50"
                          : isSelected
                            ? "border-sky-400/90 bg-sky-50 shadow-sm dark:border-sky-500/50 dark:bg-sky-950/45"
                            : "border-slate-200/80 bg-white/90 dark:border-slate-700 dark:bg-slate-900/60"
                      )}
                    >
                      <ConversationPickerAvatar
                        photoUrl={otherPartyAvatarUrl(c)}
                        initial={initial}
                        isSelected={isSelected}
                        activeCleanerTheme={activeCleanerTheme}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="break-words text-[11px] font-semibold leading-snug text-slate-900 dark:text-slate-50">
                            {titleLine}
                          </p>
                          {relativeLabel ? (
                            <span className="shrink-0 text-[9px] tabular-nums text-slate-400 dark:text-slate-500">
                              {relativeLabel}
                            </span>
                          ) : null}
                        </div>
                        {loc ? (
                          <p className="mt-0.5 truncate text-[9px] text-slate-400 dark:text-slate-500">
                            {loc}
                          </p>
                        ) : null}
                        {c.lastMessageText ? (
                          <p className="mt-0.5 line-clamp-2 text-[10px] italic leading-snug text-slate-500 dark:text-slate-400">
                            {c.lastMessageText}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {completedConvos.length > 0 && (
            <div
              className={cn(
                "min-h-0 shrink-0 border-t border-slate-200/80 px-2 pb-2 pt-1.5 dark:border-slate-800",
                activeConvos.length === 0 && "border-t-0 pt-0"
              )}
            >
              {historyBlockMobile}
            </div>
          )}
        </div>
      </div>

      {/* Desktop: conversation list */}
      <div className="hidden w-full max-h-[min(38vh,300px)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/95 to-white shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-900/95 lg:flex lg:max-h-none lg:w-[min(100%,19rem)] lg:shrink-0 xl:w-[21rem]">
        <div className="shrink-0 border-b border-slate-200/80 px-3 py-1.5 dark:border-slate-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Chats
          </p>
          <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-500">
            Select a thread. View job opens from the chat header.
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
                const { titleLine, initial, relativeLabel, activeCleanerTheme } = threadMeta(c);
                const loc =
                  c.listingSuburb || c.listingPostcode
                    ? `${c.listingSuburb ?? ""} ${c.listingPostcode ?? ""}`.trim()
                    : null;

                return (
                  <button
                    key={c.jobId}
                    type="button"
                    onClick={() => setSelectedJobId(c.jobId)}
                    className={cn(
                      "flex w-full items-center gap-2 overflow-hidden rounded-lg border px-2 py-1.5 text-left transition",
                      isSelected && activeCleanerTheme
                        ? "border-emerald-400/85 bg-emerald-50 dark:border-emerald-500/45 dark:bg-emerald-950/45"
                        : isSelected
                          ? "border-sky-400/80 bg-sky-50 dark:border-sky-500/50 dark:bg-sky-950/50"
                          : "border-transparent bg-white/50 hover:bg-slate-100/90 dark:bg-transparent dark:hover:bg-slate-800/70"
                    )}
                  >
                    <ConversationPickerAvatar
                      photoUrl={otherPartyAvatarUrl(c)}
                      initial={initial}
                      isSelected={isSelected}
                      activeCleanerTheme={activeCleanerTheme}
                      size="desktop"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="break-words text-[12px] font-semibold leading-tight text-slate-900 dark:text-slate-100 sm:text-[13px]">
                          {titleLine}
                        </p>
                        {relativeLabel && (
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                            {relativeLabel}
                          </span>
                        )}
                      </div>
                      {loc && (
                        <p className="truncate text-[9px] text-slate-400 dark:text-slate-500 sm:text-[10px]">
                          {loc}
                        </p>
                      )}
                      {c.lastMessageText && (
                        <p className="mt-0.5 line-clamp-1 text-[10px] italic text-slate-500 dark:text-slate-400">
                          {c.lastMessageText}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {completedConvos.length > 0 && (
            <div
              className={cn(
                "mt-2",
                activeConvos.length > 0 &&
                  "border-t border-slate-200/80 pt-2 dark:border-slate-800"
              )}
            >
              {historyBlockDesktop}
            </div>
          )}
        </div>
      </div>

      {/* Chat panel — fills remaining viewport height on mobile */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!selected ? (
          <Card className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-8 text-center text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900/40">
            <p className="max-w-sm text-foreground/80 dark:text-slate-200">
              {activeConvos.length === 0 && completedConvos.length > 0
                ? "Read-only history: open Past chats, choose a thread, then choose it again to hide."
                : "Select a conversation to open messages."}
            </p>
          </Card>
        ) : (
          <JobChat
            jobId={selected.jobId}
            currentUserId={currentUserId}
            canChat={isChatUnlockedForJobStatus(selected.jobStatus)}
            activeAppRole={activeAppRole}
            messengerRoleFilter={messengerRoleFilter}
            listerId={selected.listerId}
            cleanerId={selected.cleanerId}
            listerName={selected.listerName}
            cleanerName={selected.cleanerName}
            listerAvatarUrl={selected.listerAvatarUrl}
            cleanerAvatarUrl={selected.cleanerAvatarUrl}
            messagesLayout
            viewJobHref={`/jobs/${selected.jobId}`}
            className="min-h-0 flex-1 rounded-xl border border-slate-200/90 shadow-sm dark:border-slate-800 lg:rounded-2xl lg:border-0 lg:shadow-none"
            messenger={{
              jobTitle: selected.listingTitle ?? "Bond clean job",
              listingSuburb: selected.listingSuburb,
              listingState: selected.listingState,
              listingPostcode: selected.listingPostcode,
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

