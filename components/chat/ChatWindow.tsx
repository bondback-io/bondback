"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import { sendJobMessage, markJobMessagesRead } from "@/lib/actions/job-messages";
import { uploadProcessedPhotos } from "@/lib/actions/upload-photos";
import { useIsOffline } from "@/hooks/use-offline";
import { useToast } from "@/components/ui/use-toast";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { cn } from "@/lib/utils";
import {
  jobParticipantRole,
  messageSenderJobRole,
  normalizeChatUid,
} from "@/lib/chat-participant-role";

type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];
type JobMessageUiRow = JobMessageRow & { sender_role?: "lister" | "cleaner" | null };

export type ChatWindowProps = {
  jobId: number;
  currentUserId: string;
  listerId: string | null;
  cleanerId: string | null;
  listerName: string | null;
  cleanerName: string | null;
  listerAvatarUrl: string | null;
  cleanerAvatarUrl: string | null;
  /** Profile active role — used for dual lister/cleaner same-user jobs and shell styling. */
  activeAppRole?: "lister" | "cleaner" | null;
  /** When set (e.g. from `/messages`), dual-role users only open threads for their current inbox mode. */
  messengerRoleFilter?: "lister" | "cleaner" | null;
  jobTitle: string;
  agreedPriceLabel: string;
  /** Short job status label (e.g. In progress, Funds in escrow) */
  statusPillLabel: string;
  /** Compact height for floating panel */
  variant?: "default" | "compact";
  /** After payment released to cleaner — history visible, composer disabled. */
  readOnly?: boolean;
  /** `/messages` mobile: stretch inside flex parent instead of forcing ~92dvh min-height. */
  messagesLayout?: boolean;
  /** Job detail link in header (messages page). */
  viewJobHref?: string;
};

/** Splits listing titles like "2 Beds … in CURRIMUNDI" so the agreed amount can sit beside the suburb. */
function parseListingTitleInLocation(title: string): { beforeIn: string; suburb: string } | null {
  const marker = " in ";
  const idx = title.lastIndexOf(marker);
  if (idx <= 0) return null;
  const beforeIn = title.slice(0, idx).trim();
  const suburb = title.slice(idx + marker.length).trim();
  if (!beforeIn || !suburb) return null;
  return { beforeIn, suburb };
}

function isOptimisticId(id: number): boolean {
  return id < 0;
}

function mergeIncomingMessage(
  prev: JobMessageUiRow[],
  incoming: JobMessageUiRow
): JobMessageUiRow[] {
  const withoutMatchingOptimistic = prev.filter((m) => {
    if (!isOptimisticId(m.id)) return true;
    if (normalizeChatUid(m.sender_id) !== normalizeChatUid(incoming.sender_id)) return true;
    const t1 = new Date(m.created_at).getTime();
    const t2 = new Date(incoming.created_at).getTime();
    if (Math.abs(t1 - t2) > 25_000) return true;
    if (m.message_text !== incoming.message_text) return true;
    const mImg = m.image_url?.trim() || null;
    const iImg = incoming.image_url?.trim() || null;
    if (mImg || iImg) {
      if (mImg !== iImg) return true;
    }
    return false;
  });
  if (withoutMatchingOptimistic.some((m) => m.id === incoming.id)) {
    return withoutMatchingOptimistic;
  }
  return [...withoutMatchingOptimistic, incoming];
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div
        className="flex gap-1 rounded-2xl bg-[#e4e6eb] px-3 py-2.5 dark:bg-[#303030]"
        aria-hidden
      >
        <span className="chat-typing-dot h-2 w-2 rounded-full bg-[#65676b] dark:bg-gray-400" />
        <span className="chat-typing-dot chat-typing-dot-d1 h-2 w-2 rounded-full bg-[#65676b] dark:bg-gray-400" />
        <span className="chat-typing-dot chat-typing-dot-d2 h-2 w-2 rounded-full bg-[#65676b] dark:bg-gray-400" />
      </div>
      <span className="text-xs text-[#65676b] dark:text-gray-500">
        <span className="font-medium text-foreground/90 dark:text-gray-300">{label}</span>{" "}
        is typing…
      </span>
    </div>
  );
}

export function ChatWindow({
  jobId,
  currentUserId,
  listerId,
  cleanerId,
  listerName,
  cleanerName,
  listerAvatarUrl,
  cleanerAvatarUrl,
  activeAppRole = null,
  messengerRoleFilter = null,
  jobTitle,
  agreedPriceLabel,
  statusPillLabel,
  variant = "default",
  readOnly = false,
  messagesLayout = false,
  viewJobHref,
}: ChatWindowProps) {
  const supabase = createBrowserSupabaseClient();
  const { toast } = useToast();
  const isOffline = useIsOffline();
  const [messages, setMessages] = useState<JobMessageUiRow[]>([]);
  const [text, setText] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingPeerLabel, setTypingPeerLabel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSendCooldownRef = useRef(0);
  const typingChannelRef = useRef<ReturnType<
    typeof supabase.channel
  > | null>(null);

  /** Job participant role (lister vs cleaner on this thread); `activeAppRole` disambiguates dual-hat jobs. */
  const participantRole = useMemo(
    () =>
      jobParticipantRole(
        currentUserId,
        listerId,
        cleanerId,
        activeAppRole ?? null,
        messengerRoleFilter
      ),
    [currentUserId, listerId, cleanerId, activeAppRole, messengerRoleFilter]
  );
  const shellRole = participantRole;

  const otherPartyFirstName = useMemo(() => {
    if (!shellRole) return "Partner";
    const isMeLister = shellRole === "lister";
    const raw = isMeLister ? cleanerName : listerName;
    return (raw ?? (isMeLister ? "Cleaner" : "Owner")).split(" ")[0] ?? "Partner";
  }, [shellRole, cleanerName, listerName]);

  const titleLocation = useMemo(
    () => parseListingTitleInLocation(jobTitle.trim()),
    [jobTitle]
  );

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (!participantRole) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("job_messages")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      if (!cancelled && data) {
        setMessages(data as JobMessageUiRow[]);
      }
    };

    void load();

    const channel = supabase
      .channel(`job-messages-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_messages",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          const row = payload.new as JobMessageUiRow;
          if (
            normalizeChatUid(row.sender_id) !== normalizeChatUid(currentUserId)
          ) {
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = null;
            }
            setTypingPeerLabel(null);
          }
          setMessages((prev) => mergeIncomingMessage(prev, row));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job_messages",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          const row = payload.new as JobMessageUiRow;
          setMessages((prev) =>
            prev.map((m) => (m.id === row.id ? row : m))
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, jobId, currentUserId, participantRole]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, typingPeerLabel, scrollToBottom]);

  const markRead = useCallback(() => {
    void markJobMessagesRead(jobId);
  }, [jobId]);

  useEffect(() => {
    if (!participantRole) return;
    void markRead();
  }, [markRead, jobId, messages.length, participantRole]);

  useEffect(() => {
    if (!participantRole) return;
    const onVis = () => {
      if (document.visibilityState === "visible") void markRead();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [markRead, participantRole]);

  useEffect(() => {
    if (!participantRole) return;
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{
        jobId: number;
        message: JobMessageUiRow;
      }>;
      if (!custom.detail) return;
      const { jobId: evtJobId, message } = custom.detail;
      if (evtJobId !== jobId) return;
      if (normalizeChatUid(message.sender_id) === normalizeChatUid(currentUserId)) return;
      setMessages((prev) => mergeIncomingMessage(prev, message));
    };
    window.addEventListener("bondback:job-message-sent", handler as EventListener);
    return () => {
      window.removeEventListener(
        "bondback:job-message-sent",
        handler as EventListener
      );
    };
  }, [jobId, currentUserId, participantRole]);

  useEffect(() => {
    if (!participantRole) {
      return () => {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        const prev = typingChannelRef.current;
        if (prev) {
          void supabase.removeChannel(prev);
          typingChannelRef.current = null;
        }
      };
    }
    const ch = supabase.channel(`job-typing-${jobId}`, {
      config: { broadcast: { ack: false } },
    });
    typingChannelRef.current = ch;

    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      const p = payload as { userId?: string; label?: string };
      if (
        !p?.userId ||
        normalizeChatUid(p.userId) === normalizeChatUid(currentUserId)
      )
        return;
      setTypingPeerLabel(p.label ?? otherPartyFirstName);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingPeerLabel(null);
      }, 2800);
    })
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        const row = payload as JobMessageUiRow | null;
        if (!row || row.id == null || Number(row.job_id) !== Number(jobId)) return;
        if (
          normalizeChatUid(row.sender_id) !== normalizeChatUid(currentUserId)
        ) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
          }
          setTypingPeerLabel(null);
        }
        setMessages((prev) => mergeIncomingMessage(prev, row));
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [supabase, jobId, currentUserId, otherPartyFirstName, participantRole]);

  const broadcastTyping = useCallback(() => {
    const ch = typingChannelRef.current;
    if (!ch) return;
    const now = Date.now();
    if (now - typingSendCooldownRef.current < 1800) return;
    typingSendCooldownRef.current = now;
    const label =
      shellRole === "cleaner"
        ? (cleanerName ?? "Cleaner").split(" ")[0]
        : (listerName ?? "Owner").split(" ")[0];
    void ch.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, label },
    });
  }, [currentUserId, shellRole, cleanerName, listerName]);

  const handleSend = () => {
    if (readOnly) return;
    setError(null);
    if (isOffline) {
      toast({
        title: "Offline",
        description: "Reconnect to send a message.",
        variant: "destructive",
      });
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;

    const optimisticId = -Math.abs(Date.now());
    const nowIso = new Date().toISOString();
    const optimistic: JobMessageUiRow = {
      id: optimisticId,
      job_id: jobId,
      sender_id: currentUserId,
      message_text: trimmed,
      created_at: nowIso,
      image_url: null,
      read_at: null,
      sender_role: shellRole ?? "lister",
    };

    setText("");
    setMessages((prev) => [...prev, optimistic]);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("bondback:job-message-sent", {
          detail: { jobId, message: optimistic },
        })
      );
    }

    void (async () => {
      const res = await sendJobMessage(jobId, trimmed);
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setText(trimmed);
        setError(res.error);
        return;
      }
      const liveCh = typingChannelRef.current;
      if (res.message && liveCh) {
        void liveCh.send({
          type: "broadcast",
          event: "chat_message",
          payload: res.message,
        });
      }
      void markRead();
    })();
  };

  const handlePhotoSelected = async (files: FileList | null) => {
    if (readOnly) return;
    const file = files?.[0];
    if (!file || isOffline) {
      if (isOffline) {
        toast({
          title: "Offline",
          description: "Reconnect to upload.",
          variant: "destructive",
        });
      }
      return;
    }
    setError(null);
    setUploadingImage(true);
    try {
      // Let the browser paint the loading state before the server action runs.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      const fd = new FormData();
      fd.append("file", file);
      const { ok, results, error: upErr } = await uploadProcessedPhotos(fd, {
        bucket: "condition-photos",
        pathPrefix: `jobs/${jobId}/chat`,
        maxFiles: 1,
        existingCount: 0,
        generateThumb: true,
      });
      if (upErr || !ok) {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: upErr ?? "Could not upload image.",
        });
        return;
      }
      const url = results.find((r) => r.url)?.url;
      if (!url) {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: results[0]?.error ?? "No image URL returned.",
        });
        return;
      }
      const caption = text.trim();
      const optimisticId = -Math.abs(Date.now() + 1);
      const nowIso = new Date().toISOString();
      const optimistic: JobMessageUiRow = {
        id: optimisticId,
        job_id: jobId,
        sender_id: currentUserId,
        message_text: caption || "Photo",
        created_at: nowIso,
        image_url: url,
        read_at: null,
        sender_role: shellRole ?? "lister",
      };
      setMessages((prev) => [...prev, optimistic]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("bondback:job-message-sent", {
            detail: { jobId, message: optimistic },
          })
        );
      }
      setText("");

      const res = await sendJobMessage(jobId, caption || "Photo", {
        imageUrl: url,
      });
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setText(caption);
        setError(res.error);
        return;
      }
      const liveCh = typingChannelRef.current;
      if (res.message && liveCh) {
        void liveCh.send({
          type: "broadcast",
          event: "chat_message",
          payload: res.message,
        });
      }
      void markRead();
    } finally {
      setUploadingImage(false);
    }
  };

  const heightClass = messagesLayout
    ? "min-h-0 h-full w-full flex-1 max-lg:min-h-0 max-lg:flex-1 lg:flex-none lg:min-h-[min(92dvh,720px)]"
    : variant === "compact"
      ? "min-h-[260px] max-h-[52vh] sm:max-h-[58vh]"
      : "min-h-[min(92dvh,720px)] sm:min-h-[520px]";

  const isListerRole = shellRole === "lister";
  const isCleanerRole = shellRole === "cleaner";
  const shellBg = isListerRole
    ? "bg-gradient-to-b from-sky-100/90 via-sky-50/50 to-[#e0edff] dark:from-slate-950 dark:via-slate-950 dark:to-slate-900"
    : isCleanerRole
      ? "bg-gradient-to-b from-emerald-100/85 via-emerald-50/40 to-[#d8f5e5]/90 dark:from-emerald-950/50 dark:via-slate-950 dark:to-emerald-950/20"
      : "bg-[#f0f2f5] dark:bg-[#18191a]";
  const headerBar = isListerRole
    ? "border-sky-200/90 bg-white/95 dark:border-sky-800/40 dark:bg-slate-950/90 dark:backdrop-blur-sm"
    : isCleanerRole
      ? "border-emerald-200/80 bg-white/95 dark:border-emerald-800/35 dark:bg-slate-950/90 dark:backdrop-blur-sm"
      : "border-[#e5e5e5] bg-white dark:border-slate-800 dark:bg-slate-950/95";
  const priceAccent = isCleanerRole
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-[#0084ff] dark:text-sky-400";
  const pillAccent = isCleanerRole
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200"
    : "bg-[#e7f3ff] text-[#0084ff] dark:bg-sky-950/80 dark:text-sky-300";

  if (!participantRole) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 py-10 text-center dark:border-slate-800 dark:bg-slate-950/60",
          messagesLayout ? "min-h-0 flex-1" : "min-h-[240px] sm:min-h-[280px]"
        )}
      >
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
          This job chat isn&apos;t available in your current mode
        </p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Switch between <span className="font-medium text-foreground">Lister</span> and{" "}
          <span className="font-medium text-foreground">Cleaner</span> in the header to open the inbox
          that matches how you&apos;re participating on this job.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden",
        messagesLayout
          ? "max-lg:shadow-none lg:shadow-lg lg:dark:shadow-black/40"
          : "shadow-lg dark:shadow-black/40",
        shellBg,
        messagesLayout
          ? cn(
              "max-lg:rounded-xl lg:rounded-2xl lg:border lg:shadow-lg dark:lg:border-slate-800",
              isListerRole &&
                "lg:border-sky-200/70 dark:lg:border-sky-800/60",
              isCleanerRole &&
                "lg:border-emerald-200/70 dark:lg:border-emerald-800/50",
              !isListerRole &&
                !isCleanerRole &&
                "lg:border-[#e5e5e5] dark:lg:border-slate-800"
            )
          : cn(
              "sm:rounded-2xl sm:border dark:sm:border-slate-800",
              isListerRole && "sm:border-sky-200/70 dark:sm:border-sky-800/60",
              isCleanerRole && "sm:border-emerald-200/70 dark:sm:border-emerald-800/50",
              !isListerRole && !isCleanerRole && "sm:border-[#e5e5e5]"
            ),
        heightClass
      )}
    >
      {/* Job header — title + suburb + amount (compact on mobile), status pill, View job */}
      <header
        className={cn(
          "sticky top-0 z-10 shrink-0 border-b px-2.5 py-1.5 shadow-sm sm:px-4 sm:py-2",
          headerBar
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-1 sm:gap-2">
          <div className="flex items-start justify-between gap-1.5 sm:gap-3">
            <div className="min-w-0 flex-1">
              {titleLocation ? (
                <p className="line-clamp-3 text-[12px] font-bold leading-snug tracking-tight text-[#050505] dark:text-slate-50 sm:line-clamp-2 sm:text-[15px] sm:leading-snug">
                  <span>{titleLocation.beforeIn}</span>
                  <span className="font-bold text-[#050505] dark:text-slate-50"> in </span>
                  <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0 align-baseline">
                    <span className="break-words">{titleLocation.suburb}</span>
                    <span
                      className={cn(
                        "shrink-0 text-[11px] font-semibold tabular-nums sm:text-[15px]",
                        priceAccent
                      )}
                    >
                      {agreedPriceLabel}
                    </span>
                  </span>
                </p>
              ) : (
                <>
                  <h2 className="line-clamp-2 text-[12px] font-bold leading-snug tracking-tight text-[#050505] dark:text-slate-50 sm:text-[16px]">
                    {jobTitle}
                  </h2>
                  <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <p
                      className={cn(
                        "text-[11px] font-semibold tabular-nums sm:text-[15px]",
                        priceAccent
                      )}
                    >
                      {agreedPriceLabel}
                    </p>
                    {viewJobHref ? (
                      <Link
                        href={viewJobHref}
                        className={cn(
                          "inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold no-underline transition active:opacity-70 sm:text-[13px]",
                          isCleanerRole
                            ? "text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                            : isListerRole
                              ? "text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                              : "text-primary hover:underline"
                        )}
                      >
                        View job
                        <ChevronRight className="h-3 w-3 opacity-80 sm:h-3.5 sm:w-3.5" aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                </>
              )}
            </div>
            <span
              className={cn(
                "max-w-[min(42%,9.5rem)] shrink-0 self-start rounded-full px-1.5 py-0.5 text-center text-[8px] font-semibold uppercase leading-tight tracking-wide sm:max-w-none sm:px-2.5 sm:py-1 sm:text-[10px] sm:normal-case sm:tracking-normal",
                pillAccent
              )}
            >
              {statusPillLabel}
            </span>
          </div>
          {titleLocation && viewJobHref ? (
            <div className="flex justify-end">
              <Link
                href={viewJobHref}
                className={cn(
                  "inline-flex items-center gap-0.5 text-[11px] font-semibold no-underline transition active:opacity-70 sm:text-[13px]",
                  isCleanerRole
                    ? "text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                    : isListerRole
                      ? "text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                      : "text-primary hover:underline"
                )}
              >
                View job
                <ChevronRight className="h-3 w-3 opacity-80 sm:h-3.5 sm:w-3.5" aria-hidden />
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      {readOnly && (
        <div
          className="shrink-0 border-b border-amber-200/90 bg-amber-50 px-3 py-2 text-center text-[11px] font-medium leading-snug text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100 sm:px-4 sm:text-xs"
          role="status"
        >
          Payment has been released for this job. This chat is read-only — you can still read the
          message history.
        </div>
      )}

      {/* Message list */}
      <div
        ref={scrollRef}
        className="chat-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-y-contain px-2 py-2 [-webkit-overflow-scrolling:touch] sm:gap-1 sm:px-3 sm:py-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <p className="text-[15px] font-semibold text-[#050505] dark:text-gray-200">
              No messages yet
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#65676b] dark:text-gray-500">
              Say hello — keep all job communication here so escrow and disputes stay protected.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isMe =
              normalizeChatUid(m.sender_id) === normalizeChatUid(currentUserId);
            const persistedRole =
              m.sender_role === "lister" || m.sender_role === "cleaner"
                ? m.sender_role
                : null;
            const senderRole = persistedRole ?? messageSenderJobRole(m.sender_id, listerId, cleanerId);
            const isListerSender = senderRole === "lister";
            const senderLabel = isListerSender
              ? (listerName?.trim() || "Lister")
              : (cleanerName?.trim() || "Cleaner");
            const avatarUrl = isListerSender ? listerAvatarUrl : cleanerAvatarUrl;
            const prev = messages[i - 1];
            const showAvatar =
              !isMe &&
              (!prev ||
                normalizeChatUid(prev.sender_id) !==
                  normalizeChatUid(m.sender_id) ||
                new Date(m.created_at).getTime() -
                  new Date(prev.created_at).getTime() >
                  5 * 60 * 1000);

            const isDelivered = !isOptimisticId(m.id);
            const isRead = isMe && !!m.read_at;

            return (
              <MessageBubble
                key={m.id}
                message={m}
                isMe={isMe}
                showAvatar={showAvatar}
                avatarUrl={avatarUrl}
                senderLabel={senderLabel}
                senderRole={senderRole}
                isDelivered={isDelivered}
                isRead={isRead}
              />
            );
          })
        )}

        {typingPeerLabel && <TypingIndicator label={typingPeerLabel} />}
      </div>

      <ChatInput
        value={text}
        onChange={(v) => {
          setText(v);
          if (v.trim().length > 0) broadcastTyping();
        }}
        onSend={() => void handleSend()}
        sending={uploadingImage}
        isOffline={isOffline}
        onPhotoSelected={(files) => void handlePhotoSelected(files)}
        accentRole={shellRole}
        disabled={readOnly}
        placeholder={readOnly ? "Read-only chat" : "Aa"}
      />
      {error && (
        <p className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-[11px] text-destructive dark:bg-destructive/15">
          {error}
        </p>
      )}
    </div>
  );
}
