"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

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
  listerAvatarUrl: string | null;
  cleanerAvatarUrl: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
};

type ChatPanelState = {
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
        .in("status", ["in_progress", "completed"] as never[]);

      const jobs = (jobsData ?? []) as JobRow[];
      if (cancelled) return;
      if (!jobs.length) {
        setConversations([]);
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

        return {
          jobId: job.id as number,
          status: job.status ?? null,
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
      });

      setConversations(convos);
      if (!selectedJobId) {
        const first = convos[0];
        if (first) setSelectedJobId(first.jobId);
      }
    };

    load().catch((err) => {
      if (!cancelled && process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[ChatPanelProvider] Failed to load conversations:", err?.message ?? err);
      }
      if (!cancelled) setConversations([]);
    });
    return () => {
      cancelled = true;
    };
    // Refetch when panel opens so a job just approved on /jobs/[id] appears in the list
  }, [currentUserId, supabase, selectedJobId, isOpen]);

  // Realtime updates for new messages: update preview + unread count
  useEffect(() => {
    if (!currentUserId || conversations.length === 0) return;

    const jobIds = conversations.map((c) => c.jobId);
    const channel = supabase
      .channel("chat-panel-job-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_messages",
          filter: `job_id=in.(${jobIds.join(",")})`,
        },
        (payload) => {
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
          if (m.sender_id !== currentUserId) {
            setUnreadByJob((prev) => ({
              ...prev,
              [m.job_id]:
                (selectedJobId === m.job_id && isOpen
                  ? 0
                  : (prev[m.job_id] ?? 0) + 1),
            }));

            // Auto-open logic: only if enabled and tab focused.
            if (
              autoOpenOnNewMessage &&
              typeof document !== "undefined" &&
              document.hasFocus()
            ) {
              // If panel is closed, open after a short delay and jump to this job.
              if (!isOpen) {
                setTimeout(() => {
                  setIsOpen(true);
                  setSelectedJobId(m.job_id as number);
                  setUnreadByJob((prev) => ({
                    ...prev,
                    [m.job_id]: 0,
                  }));
                }, 900);
              } else if (selectedJobId !== m.job_id) {
                // If panel already open but showing another job, jump to this one.
                setSelectedJobId(m.job_id as number);
                setUnreadByJob((prev) => ({
                  ...prev,
                  [m.job_id]: 0,
                }));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversations, currentUserId, supabase, selectedJobId, isOpen]);

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

