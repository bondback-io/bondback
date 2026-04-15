"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import { CHAT_UNLOCK_STATUSES } from "@/lib/chat-unlock";
import {
  messengerPeerCleanerUsername,
  messengerPeerDisplayName,
} from "@/lib/chat-messenger-display";

/** Max job ids per Supabase `in.(...)` realtime filter — keeps URL size safe with many chats. */
const REALTIME_JOB_ID_CHUNK = 45;

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type Conversation = {
  jobId: number;
  status: string | null;
  listingTitle: string | null;
  listingSuburb: string | null;
  listingPostcode: string | null;
  otherPartyName: string | null;
  otherPartyRole: "cleaner" | "lister";
  listerId: string | null;
  cleanerId: string | null;
  listerName: string | null;
  cleanerName: string | null;
  /** Sidebar / list title for the other participant. */
  otherPartyDisplayName: string;
  /** Marketplace username when the other party is the cleaner (for “(@username)”). */
  otherPartyUsername: string | null;
  listerAvatarUrl: string | null;
  cleanerAvatarUrl: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  agreedAmountCents: number | null;
  autoReleaseAt: string | null;
  cleanerConfirmedComplete: boolean;
  hasPaymentHold: boolean;
  paymentReleasedAt: string | null;
};

type ChatPanelState = {
  currentUserId: string | null;
  isOpen: boolean;
  isCollapsed: boolean;
  selectedJobId: number | null;
  unreadByJob: Record<number, number>;
  unreadTotal: number;
  conversations: Conversation[];
};

type ChatPanelContextValue = ChatPanelState & {
  toggleOpen: () => void;
  openPanel: () => void;
  closePanel: () => void;
  toggleCollapsed: () => void;
  selectJob: (jobId: number | null) => void;
};

const ChatPanelContext = createContext<ChatPanelContextValue | null>(null);

type ChatPanelProviderProps = {
  currentUserId: string | null;
  autoOpenOnNewMessage?: boolean;
  children: ReactNode;
};

export function ChatPanelProvider({
  currentUserId,
  autoOpenOnNewMessage = true,
  children,
}: ChatPanelProviderProps) {
  const supabase = createBrowserSupabaseClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadByJob, setUnreadByJob] = useState<Record<number, number>>({});

  const selectedJobIdRef = useRef(selectedJobId);
  const isOpenRef = useRef(isOpen);
  const autoOpenRef = useRef(autoOpenOnNewMessage);
  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  useEffect(() => {
    autoOpenRef.current = autoOpenOnNewMessage;
  }, [autoOpenOnNewMessage]);

  /** Stable while conversation previews update — avoids tearing down realtime on every new message. */
  const conversationJobIdsFingerprint = useMemo(() => {
    if (conversations.length === 0) return "";
    return [...new Set(conversations.map((c) => c.jobId))]
      .sort((a, b) => a - b)
      .join(",");
  }, [conversations]);

  // Load active jobs + metadata when user or when panel opens (so approved jobs appear)
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;

    const load = async () => {
      // Only show chat for jobs approved to start (in_progress). Hide chat and cleaner
      // until lister has approved; cleaners also don't see the panel until then.
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("*")
        .or(
          `lister_id.eq.${currentUserId},winner_id.eq.${currentUserId}` as never
        )
        .in("status", [...CHAT_UNLOCK_STATUSES] as never[]);

      const jobs = (jobsData ?? []) as JobRow[];
      if (cancelled) return;
      if (!jobs.length) {
        setConversations([]);
        setSelectedJobId(null);
        return;
      }

      const jobIds = jobs.map((j) => j.id);
      const listingIds = jobs.map((j) => j.listing_id);

      const [{ data: listingsData }, { data: profilesData }, { data: msgData }] =
        await Promise.all([
          supabase
            .from("listings")
            .select("*")
            .in("id", listingIds as any),
          supabase
            .from("profiles")
            .select("*")
            .in(
              "id",
              Array.from(
                new Set(
                  jobs
                    .map((j) => [j.lister_id, j.winner_id])
                    .flat()
                    .filter(Boolean) as string[]
                )
              ) as any
            ),
          supabase
            .from("job_messages")
            .select("*")
            .in("job_id", jobIds as any)
            .order("created_at", { ascending: false }),
        ]);

      if (cancelled) return;

      const listings = (listingsData ?? []) as ListingRow[];
      const profiles = (profilesData ?? []) as ProfileRow[];
      const messages = (msgData ?? []) as JobMessageRow[];

      const listingById = new Map<string | number, ListingRow>();
      listings.forEach((l) => listingById.set(l.id as string | number, l));

      const profileById = new Map<string, ProfileRow>();
      profiles.forEach((p) => profileById.set(p.id as string, p));

      const latestByJob: Record<number, JobMessageRow | undefined> = {};
      for (const m of messages) {
        if (!latestByJob[m.job_id]) {
          latestByJob[m.job_id] = m;
        }
      }

      const convos: Conversation[] = jobs.map((job) => {
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
        const listerDisplay = messengerPeerDisplayName(listerProfile, "Owner");
        const cleanerDisplay = messengerPeerDisplayName(
          cleanerProfile,
          "Cleaner"
        );
        const otherPartyDisplayName =
          otherPartyRole === "cleaner" ? cleanerDisplay : listerDisplay;
        const otherPartyUsername =
          otherPartyRole === "cleaner"
            ? messengerPeerCleanerUsername(cleanerProfile)
            : messengerPeerCleanerUsername(listerProfile);

        return {
          jobId: job.id as number,
          status: job.status ?? null,
          listingTitle: listing?.title ?? null,
          listingSuburb: listing?.suburb ?? null,
          listingPostcode: listing?.postcode ?? null,
          otherPartyName: otherPartyDisplayName,
          otherPartyRole,
          listerId: job.lister_id as string | null,
          cleanerId: job.winner_id as string | null,
          listerName: listerDisplay,
          cleanerName: cleanerDisplay,
          otherPartyDisplayName,
          otherPartyUsername,
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
      });

      setConversations(convos);
      setSelectedJobId((prev) => {
        if (prev != null && convos.some((c) => c.jobId === prev)) return prev;
        const first = convos[0];
        return first ? first.jobId : null;
      });
    };

    load().catch((err) => {
      if (!cancelled && process.env.NODE_ENV !== "production") {
         
        console.warn("[ChatPanelProvider] Failed to load conversations:", err?.message ?? err);
      }
      if (!cancelled) {
        setConversations([]);
        setSelectedJobId(null);
      }
    });
    return () => {
      cancelled = true;
    };
    // Refetch when panel opens so a job just approved on /jobs/[id] appears in the list.
    // Do not depend on selectedJobId — avoids refetching every time the user switches threads.
  }, [currentUserId, supabase, isOpen]);

  // Realtime updates for new messages: update preview + unread count
  useEffect(() => {
    if (!currentUserId || conversationJobIdsFingerprint.length === 0) return;

    const jobIds = conversationJobIdsFingerprint
      .split(",")
      .map((id) => parseInt(id, 10))
      .filter((n) => Number.isFinite(n));
    if (jobIds.length === 0) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    const removeAll = () => {
      for (const ch of channels) {
        void supabase.removeChannel(ch);
      }
      channels.length = 0;
    };

    const messageHandler = (payload: { new: Record<string, unknown> }) => {
      const m = payload.new as JobMessageRow;
      setConversations((prev) =>
        prev.map((c) =>
          c.jobId === m.job_id
            ? {
                ...c,
                lastMessageText: m.message_text,
                lastMessageAt: m.created_at,
              }
            : c
        )
      );
      const sel = selectedJobIdRef.current;
      const open = isOpenRef.current;
      if (m.sender_id !== currentUserId) {
        setUnreadByJob((prev) => ({
          ...prev,
          [m.job_id]:
            sel === m.job_id && open ? 0 : (prev[m.job_id] ?? 0) + 1,
        }));

        if (
          autoOpenRef.current &&
          typeof document !== "undefined" &&
          document.visibilityState === "visible" &&
          document.hasFocus()
        ) {
          if (!open) {
            setTimeout(() => {
              setIsOpen(true);
              setSelectedJobId(m.job_id as number);
              setUnreadByJob((prev) => ({
                ...prev,
                [m.job_id]: 0,
              }));
            }, 900);
          } else if (sel !== m.job_id) {
            setSelectedJobId(m.job_id as number);
            setUnreadByJob((prev) => ({
              ...prev,
              [m.job_id]: 0,
            }));
          }
        }
      }
    };

    const subscribe = () => {
      removeAll();
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      const ch = supabase.channel(
        `chat-jm:${currentUserId}:${conversationJobIdsFingerprint.slice(0, 120)}`
      );
      for (let i = 0; i < jobIds.length; i += REALTIME_JOB_ID_CHUNK) {
        const chunk = jobIds.slice(i, i + REALTIME_JOB_ID_CHUNK);
        if (chunk.length === 0) continue;
        ch.on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "job_messages",
            filter: `job_id=in.(${chunk.join(",")})`,
          },
          messageHandler
        );
      }
      ch.subscribe();
      channels.push(ch);
    };

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "hidden") {
        removeAll();
      } else {
        subscribe();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    subscribe();

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      removeAll();
    };
  }, [conversationJobIdsFingerprint, currentUserId, supabase]);

  const unreadTotal = useMemo(
    () => Object.values(unreadByJob).reduce((sum, v) => sum + v, 0),
    [unreadByJob]
  );

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      // When opening, clear unread for the selected job
      if (selectedJobId != null) {
        setUnreadByJob((prev) => ({
          ...prev,
          [selectedJobId]: 0,
        }));
      }
    }
  }, [isOpen, selectedJobId]);

  const openPanel = useCallback(() => {
    setIsOpen(true);
    if (selectedJobId != null) {
      setUnreadByJob((prev) => ({
        ...prev,
        [selectedJobId]: 0,
      }));
    }
  }, [selectedJobId]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const selectJob = useCallback((jobId: number | null) => {
    setSelectedJobId(jobId);
    if (jobId != null) {
      setUnreadByJob((prev) => ({
        ...prev,
        [jobId]: 0,
      }));
    }
  }, []);

  const value: ChatPanelContextValue = {
    currentUserId,
    isOpen,
    isCollapsed,
    selectedJobId,
    unreadByJob,
    unreadTotal,
    conversations,
    toggleOpen,
    openPanel,
    closePanel,
    toggleCollapsed,
    selectJob,
  };

  return (
    <ChatPanelContext.Provider value={value}>
      {children}
    </ChatPanelContext.Provider>
  );
}

export function useChatPanel() {
  const ctx = useContext(ChatPanelContext);
  if (!ctx) {
    throw new Error("useChatPanel must be used within ChatPanelProvider");
  }
  return ctx;
}

