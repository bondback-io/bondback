"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Pin, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  deepCleanPurposeLabel,
  normalizeServiceType,
  recurringFrequencyShortLabel,
  type ServiceTypeKey,
} from "@/lib/service-types";

const MESSAGE_PINS_STORAGE_KEY = "bb-message-pins-v1";

const INBOX_FILTER_CHIPS: { key: "all" | ServiceTypeKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "recurring_house_cleaning", label: "Recurring" },
  { key: "bond_cleaning", label: "Bond" },
  { key: "airbnb_turnover", label: "Airbnb" },
  { key: "deep_clean", label: "Deep" },
];

function serviceBadgeClasses(st: ServiceTypeKey): string {
  switch (st) {
    case "recurring_house_cleaning":
      return "bg-sky-500/12 text-sky-800 dark:bg-sky-400/14 dark:text-sky-200";
    case "bond_cleaning":
      return "bg-orange-500/12 text-orange-900 dark:bg-orange-400/14 dark:text-orange-200";
    case "airbnb_turnover":
      return "bg-teal-500/12 text-teal-900 dark:bg-teal-400/14 dark:text-teal-200";
    case "deep_clean":
      return "bg-violet-500/12 text-violet-900 dark:bg-violet-400/14 dark:text-violet-200";
    default:
      return "bg-slate-500/10 text-slate-700 dark:bg-slate-400/12 dark:text-slate-200";
  }
}

function serviceBadgeShortLabel(st: ServiceTypeKey): string {
  switch (st) {
    case "recurring_house_cleaning":
      return "Recurring";
    case "bond_cleaning":
      return "Bond";
    case "airbnb_turnover":
      return "Airbnb";
    case "deep_clean":
      return "Deep";
    default:
      return "Job";
  }
}

function buildConversationJobSummaryLine(c: {
  serviceType: ServiceTypeKey;
  recurringFrequency: string | null;
  deepCleanPurpose: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  listingSuburb: string | null;
}): string {
  const br =
    c.bedrooms != null && c.bedrooms > 0 ? `${c.bedrooms}BR` : null;
  const ba =
    c.bathrooms != null && c.bathrooms > 0 ? `${c.bathrooms}BA` : null;
  const bedBath = [br, ba].filter(Boolean).join(" ");
  const place = trimStr(c.listingSuburb ?? "") || null;

  let servicePart: string;
  switch (c.serviceType) {
    case "recurring_house_cleaning": {
      const freq = recurringFrequencyShortLabel(c.recurringFrequency);
      servicePart = freq ? `Recurring ${freq}` : "Recurring";
      break;
    }
    case "bond_cleaning":
      servicePart = "Bond clean";
      break;
    case "airbnb_turnover":
      servicePart = "Airbnb";
      break;
    case "deep_clean":
      servicePart = deepCleanPurposeLabel(c.deepCleanPurpose) || "Deep clean";
      break;
    default:
      servicePart = "Cleaning";
  }

  const parts = [servicePart];
  if (bedBath) parts.push(bedBath);
  if (place) parts.push(place);
  return parts.join(" • ");
}

function conversationRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}h`;
  return `${Math.floor(diffMin / (60 * 24))}d`;
}

function readPinnedJobIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MESSAGE_PINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => (typeof x === "number" ? x : Number(x)))
      .filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

function writePinnedJobIds(ids: number[]) {
  try {
    window.localStorage.setItem(MESSAGE_PINS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

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
  serviceType: ServiceTypeKey;
  recurringFrequency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  deepCleanPurpose: string | null;
  jobSummaryLine: string;
};

function sortConversationsForInbox(
  list: Conversation[],
  pinnedJobIds: number[]
): Conversation[] {
  const pinRank = new Map(pinnedJobIds.map((id, i) => [id, i]));
  return [...list].sort((a, b) => {
    const aPin = pinRank.has(a.jobId);
    const bPin = pinRank.has(b.jobId);
    if (aPin && !bPin) return -1;
    if (!aPin && bPin) return 1;
    if (aPin && bPin) {
      return (pinRank.get(a.jobId) ?? 0) - (pinRank.get(b.jobId) ?? 0);
    }
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });
}

function otherPartyAvatarUrl(c: Conversation): string | null {
  return c.otherPartyRole === "cleaner" ? c.cleanerAvatarUrl : c.listerAvatarUrl;
}

type CompactChatRowProps = {
  c: Conversation;
  isSelected: boolean;
  currentUserId: string;
  unreadCount: number;
  isPinned: boolean;
  onSelect: () => void;
  onTogglePin: (e: MouseEvent<HTMLButtonElement>) => void;
  density: "mobile" | "desktop";
};

function CompactChatRow({
  c,
  isSelected,
  currentUserId,
  unreadCount,
  isPinned,
  onSelect,
  onTogglePin,
  density,
}: CompactChatRowProps) {
  const display = String(c.otherPartyDisplayName ?? "");
  const uname = c.otherPartyUsername;
  const initial = (
    display.replace(/^@/, "").trim().charAt(0) || "?"
  ).toUpperCase();
  const isCurrentUserLister = isJobListerUser(currentUserId, c.listerId);
  const activeCleanerTheme = isCurrentUserLister && c.cleanerId != null;
  const relativeLabel = conversationRelativeTime(c.lastMessageAt);
  const escrowActive = c.hasPaymentHold && c.paymentReleasedAt == null;
  const st = c.serviceType;
  const isDesktop = density === "desktop";

  return (
    <div
      className={cn(
        "relative flex min-h-[58px] items-stretch overflow-hidden rounded-xl border transition [-webkit-tap-highlight-color:transparent]",
        isSelected && activeCleanerTheme
          ? "border-emerald-400/90 bg-emerald-50/95 shadow-sm dark:border-emerald-500/45 dark:bg-emerald-950/40"
          : isSelected
            ? "border-sky-400/90 bg-sky-50/95 shadow-sm dark:border-sky-500/45 dark:bg-sky-950/40"
            : "border-slate-200/80 bg-white/95 dark:border-slate-700/90 dark:bg-slate-900/55"
      )}
    >
      {unreadCount > 0 ? (
        <span
          className="pointer-events-none absolute left-0 top-2 bottom-2 z-10 w-[3px] rounded-full bg-sky-500 dark:bg-sky-400"
          aria-hidden
        />
      ) : null}
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex min-h-0 min-w-0 flex-1 touch-manipulation items-center gap-2 py-1.5 pl-2 pr-1 text-left active:scale-[0.995]",
          isDesktop ? "gap-2.5 pl-2.5" : "gap-1.5"
        )}
      >
        <ConversationPickerAvatar
          photoUrl={otherPartyAvatarUrl(c)}
          initial={initial}
          isSelected={isSelected}
          activeCleanerTheme={activeCleanerTheme}
          size={isDesktop ? "desktop" : "default"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate font-semibold leading-tight text-slate-900 dark:text-slate-50",
                  isDesktop ? "text-[12px] sm:text-[13px]" : "text-[11px]"
                )}
              >
                {display}
              </span>
              {uname ? (
                <span
                  className={cn(
                    "block truncate text-slate-500 dark:text-slate-400",
                    isDesktop ? "text-[10px]" : "text-[9px]"
                  )}
                >
                  @{uname}
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              {relativeLabel ? (
                <span
                  className={cn(
                    "tabular-nums text-slate-400 dark:text-slate-500",
                    isDesktop ? "text-[10px]" : "text-[9px]"
                  )}
                >
                  {relativeLabel}
                </span>
              ) : null}
              {unreadCount > 0 ? (
                <span
                  className={cn(
                    "flex min-w-[1.125rem] items-center justify-center rounded-full bg-sky-600 px-1 font-semibold text-white dark:bg-sky-500",
                    isDesktop ? "text-[9px]" : "text-[8px]"
                  )}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
            <span
              className={cn(
                "inline-flex shrink-0 rounded px-1 py-px text-[8px] font-semibold uppercase tracking-wide",
                serviceBadgeClasses(st)
              )}
            >
              {serviceBadgeShortLabel(st)}
            </span>
            {escrowActive ? (
              <span className="inline-flex shrink-0 rounded bg-emerald-500/14 px-1 py-px text-[7px] font-semibold tracking-wide text-emerald-800 dark:bg-emerald-400/16 dark:text-emerald-200">
                FUNDS IN ESCROW
              </span>
            ) : null}
          </div>
          <span
            className={cn(
              "block min-w-0 truncate text-slate-600 dark:text-slate-400",
              isDesktop ? "text-[10px]" : "text-[9px]"
            )}
          >
            {c.jobSummaryLine}
          </span>
          {c.lastMessageText ? (
            <span
              className={cn(
                "mt-0.5 block truncate text-slate-500 dark:text-slate-400",
                isDesktop ? "text-[10px]" : "text-[9px]"
              )}
            >
              {c.lastMessageText}
            </span>
          ) : (
            <span
              className={cn(
                "mt-0.5 block truncate italic text-slate-400 dark:text-slate-500",
                isDesktop ? "text-[10px]" : "text-[9px]"
              )}
            >
              No messages yet
            </span>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        className={cn(
          "flex shrink-0 touch-manipulation items-center justify-center border-l border-slate-200/80 bg-slate-50/80 px-1.5 dark:border-slate-700/80 dark:bg-slate-900/40",
          isPinned && "bg-amber-50/90 dark:bg-amber-950/25"
        )}
        aria-label={isPinned ? "Unpin chat" : "Pin chat"}
      >
        <Pin
          className={cn(
            "h-3.5 w-3.5",
            isPinned
              ? "fill-amber-400/35 text-amber-600 dark:text-amber-400"
              : "text-slate-400 dark:text-slate-500"
          )}
        />
      </button>
    </div>
  );
}

type MessagesInboxToolbarProps = {
  query: string;
  onQueryChange: (v: string) => void;
  filter: "all" | ServiceTypeKey;
  onFilterChange: (v: "all" | ServiceTypeKey) => void;
  /** Tighter spacing on small screens */
  compact?: boolean;
};

function MessagesInboxToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  compact,
}: MessagesInboxToolbarProps) {
  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search chats…"
          className={cn(
            "h-8 border-slate-200/90 bg-white/90 pl-8 text-[12px] shadow-none placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900/60 dark:placeholder:text-slate-500",
            compact && "h-7 rounded-lg py-1 text-[11px]"
          )}
          aria-label="Search conversations"
        />
      </div>
      <div
        className={cn(
          "flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          compact && "gap-0.5"
        )}
      >
        {INBOX_FILTER_CHIPS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onFilterChange(key)}
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition",
                active
                  ? "border-sky-400/80 bg-sky-500/12 text-sky-900 dark:border-sky-500/50 dark:bg-sky-400/12 dark:text-sky-100"
                  : "border-slate-200/80 bg-white/80 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800/80"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
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

        const serviceType = normalizeServiceType(listing?.service_type);
        const recurringFrequency = listing?.recurring_frequency ?? null;
        const bedrooms =
          listing?.bedrooms != null ? Number(listing.bedrooms) : null;
        const bathrooms =
          listing?.bathrooms != null ? Number(listing.bathrooms) : null;
        const deepCleanPurpose = listing?.deep_clean_purpose ?? null;
        const jobSummaryLine = buildConversationJobSummaryLine({
          serviceType,
          recurringFrequency,
          deepCleanPurpose,
          bedrooms: Number.isFinite(bedrooms) ? bedrooms : null,
          bathrooms: Number.isFinite(bathrooms) ? bathrooms : null,
          listingSuburb: listing?.suburb ?? null,
        });

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
          serviceType,
          recurringFrequency,
          bedrooms: Number.isFinite(bedrooms) ? bedrooms : null,
          bathrooms: Number.isFinite(bathrooms) ? bathrooms : null,
          deepCleanPurpose,
          jobSummaryLine,
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

  const unreadByJob = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const m of messages) {
      if (m.sender_id === currentUserId) continue;
      if (m.read_at != null && trimStr(m.read_at) !== "") continue;
      counts[m.job_id] = (counts[m.job_id] ?? 0) + 1;
    }
    return counts;
  }, [messages, currentUserId]);

  const [pinnedJobIds, setPinnedJobIds] = useState<number[]>([]);
  const [inboxQuery, setInboxQuery] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"all" | ServiceTypeKey>("all");

  useEffect(() => {
    setPinnedJobIds(readPinnedJobIds());
  }, []);

  const filteredActiveConvos = useMemo(() => {
    let list = activeConvos;
    if (inboxFilter !== "all") {
      list = list.filter((c) => c.serviceType === inboxFilter);
    }
    const q = inboxQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const hay = [
          c.otherPartyDisplayName,
          c.otherPartyUsername ? `@${c.otherPartyUsername}` : "",
          c.jobSummaryLine,
          c.lastMessageText ?? "",
          c.listingTitle ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return sortConversationsForInbox(list, pinnedJobIds);
  }, [activeConvos, inboxFilter, inboxQuery, pinnedJobIds]);

  const togglePinJob = (jobId: number) => {
    setPinnedJobIds((prev) => {
      const next = prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [jobId, ...prev];
      writePinnedJobIds(next);
      return next;
    });
  };

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
      <div className="flex min-h-0 max-h-[min(52dvh,380px)] shrink-0 flex-col lg:hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-xl border border-slate-200/90 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="min-h-0 shrink-0 space-y-1 border-b border-slate-200/70 px-2 pb-1.5 pt-1.5 dark:border-slate-800/90">
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Chats
            </p>
            <MessagesInboxToolbar
              query={inboxQuery}
              onQueryChange={setInboxQuery}
              filter={inboxFilter}
              onFilterChange={setInboxFilter}
              compact
            />
          </div>
          {activeConvos.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-slate-500 dark:text-slate-400">
              No active conversations.
            </p>
          ) : filteredActiveConvos.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-slate-500 dark:text-slate-400">
              No chats match your search or filters.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 px-2 py-1.5">
              {filteredActiveConvos.map((c) => {
                const isSelected = c.jobId === selectedJobId;
                const unread = unreadByJob[c.jobId] ?? 0;
                const isPinned = pinnedJobIds.includes(c.jobId);
                return (
                  <li key={c.jobId} className="relative z-10">
                    <CompactChatRow
                      c={c}
                      isSelected={isSelected}
                      currentUserId={currentUserId}
                      unreadCount={unread}
                      isPinned={isPinned}
                      onSelect={() => setSelectedJobId(c.jobId)}
                      onTogglePin={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePinJob(c.jobId);
                      }}
                      density="mobile"
                    />
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
        <div className="shrink-0 space-y-2 border-b border-slate-200/80 px-2.5 py-2 dark:border-slate-800 sm:px-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Chats
            </p>
            <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-500">
              Select a thread. Job details are in the chat header.
            </p>
          </div>
          <MessagesInboxToolbar
            query={inboxQuery}
            onQueryChange={setInboxQuery}
            filter={inboxFilter}
            onFilterChange={setInboxFilter}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-1.5 py-1.5 sm:px-2">
          {activeConvos.length > 0 && (
            <div className="space-y-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400/90">
                Active
              </p>
              {filteredActiveConvos.length === 0 ? (
                <p className="px-1 py-1 text-[11px] text-slate-500 dark:text-slate-400">
                  No chats match your search or filters.
                </p>
              ) : (
                filteredActiveConvos.map((c) => {
                  const isSelected = c.jobId === selectedJobId;
                  const unread = unreadByJob[c.jobId] ?? 0;
                  const isPinned = pinnedJobIds.includes(c.jobId);
                  return (
                    <CompactChatRow
                      key={c.jobId}
                      c={c}
                      isSelected={isSelected}
                      currentUserId={currentUserId}
                      unreadCount={unread}
                      isPinned={isPinned}
                      onSelect={() => setSelectedJobId(c.jobId)}
                      onTogglePin={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePinJob(c.jobId);
                      }}
                      density="desktop"
                    />
                  );
                })
              )}
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

