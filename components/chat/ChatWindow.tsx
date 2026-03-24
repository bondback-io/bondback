"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import { sendJobMessage, markJobMessagesRead } from "@/lib/actions/job-messages";
import { uploadProcessedPhotos } from "@/lib/actions/upload-photos";
import { useIsOffline } from "@/hooks/use-offline";
import { useToast } from "@/components/ui/use-toast";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { cn } from "@/lib/utils";

type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];

export type ChatWindowProps = {
  jobId: number;
  currentUserId: string;
  listerId: string | null;
  cleanerId: string | null;
  listerName: string | null;
  cleanerName: string | null;
  listerAvatarUrl: string | null;
  cleanerAvatarUrl: string | null;
  currentUserRole: "lister" | "cleaner" | null;
  jobTitle: string;
  agreedPriceLabel: string;
  /** Short job status label (e.g. In progress, Funds in escrow) */
  statusPillLabel: string;
  /** Compact height for floating panel */
  variant?: "default" | "compact";
};

function isOptimisticId(id: number): boolean {
  return id < 0;
}

function mergeIncomingMessage(
  prev: JobMessageRow[],
  incoming: JobMessageRow
): JobMessageRow[] {
  const withoutMatchingOptimistic = prev.filter((m) => {
    if (!isOptimisticId(m.id)) return true;
    if (m.sender_id !== incoming.sender_id) return true;
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
  currentUserRole,
  jobTitle,
  agreedPriceLabel,
  statusPillLabel,
  variant = "default",
}: ChatWindowProps) {
  const supabase = createBrowserSupabaseClient();
  const { toast } = useToast();
  const isOffline = useIsOffline();
  const [messages, setMessages] = useState<JobMessageRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingPeerLabel, setTypingPeerLabel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSendCooldownRef = useRef(0);
  const typingChannelRef = useRef<ReturnType<
    typeof supabase.channel
  > | null>(null);

  const otherPartyFirstName = useMemo(() => {
    const isLister = currentUserId === listerId;
    const raw = isLister ? cleanerName : listerName;
    return (raw ?? (isLister ? "Cleaner" : "Owner")).split(" ")[0] ?? "Partner";
  }, [currentUserId, listerId, cleanerName, listerName]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("job_messages")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      if (!cancelled && data) {
        setMessages(data as JobMessageRow[]);
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
          const row = payload.new as JobMessageRow;
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
          const row = payload.new as JobMessageRow;
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
  }, [supabase, jobId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, typingPeerLabel, scrollToBottom]);

  const markRead = useCallback(() => {
    void markJobMessagesRead(jobId);
  }, [jobId]);

  useEffect(() => {
    void markRead();
  }, [markRead, jobId, messages.length]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void markRead();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [markRead]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{
        jobId: number;
        message: JobMessageRow;
      }>;
      if (!custom.detail) return;
      const { jobId: evtJobId, message } = custom.detail;
      if (evtJobId !== jobId) return;
      if (message.sender_id === currentUserId) return;
      setMessages((prev) => mergeIncomingMessage(prev, message));
    };
    window.addEventListener("bondback:job-message-sent", handler as EventListener);
    return () => {
      window.removeEventListener(
        "bondback:job-message-sent",
        handler as EventListener
      );
    };
  }, [jobId, currentUserId]);

  useEffect(() => {
    const ch = supabase.channel(`job-typing-${jobId}`, {
      config: { broadcast: { ack: false } },
    });
    typingChannelRef.current = ch;

    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      const p = payload as { userId?: string; label?: string };
      if (!p?.userId || p.userId === currentUserId) return;
      setTypingPeerLabel(p.label ?? otherPartyFirstName);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingPeerLabel(null);
      }, 2800);
    })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [supabase, jobId, currentUserId, otherPartyFirstName]);

  const broadcastTyping = useCallback(() => {
    const ch = typingChannelRef.current;
    if (!ch) return;
    const now = Date.now();
    if (now - typingSendCooldownRef.current < 1800) return;
    typingSendCooldownRef.current = now;
    const label =
      currentUserRole === "cleaner"
        ? (cleanerName ?? "Cleaner").split(" ")[0]
        : (listerName ?? "Owner").split(" ")[0];
    void ch.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, label },
    });
  }, [currentUserId, currentUserRole, cleanerName, listerName]);

  const handleSend = async () => {
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
    setSending(true);
    const res = await sendJobMessage(jobId, trimmed);
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const nowIso = new Date().toISOString();
    const optimistic: JobMessageRow = {
      id: -Math.abs(Date.now()),
      job_id: jobId,
      sender_id: currentUserId,
      message_text: trimmed,
      created_at: nowIso,
      image_url: null,
      read_at: null,
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
    void markRead();
  };

  const handlePhotoSelected = async (files: FileList | null) => {
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
      setSending(true);
      const res = await sendJobMessage(jobId, caption || "Photo", {
        imageUrl: url,
      });
      setSending(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const nowIso = new Date().toISOString();
      const optimistic: JobMessageRow = {
        id: -Math.abs(Date.now() + 1),
        job_id: jobId,
        sender_id: currentUserId,
        message_text: caption || "Photo",
        created_at: nowIso,
        image_url: url,
        read_at: null,
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
      void markRead();
    } finally {
      setUploadingImage(false);
    }
  };

  const heightClass =
    variant === "compact"
      ? "min-h-[280px] max-h-[55vh] sm:max-h-[60vh]"
      : "min-h-[min(100dvh,800px)] sm:min-h-[560px]";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-[#f0f2f5] shadow-lg",
        "dark:bg-[#18191a] dark:shadow-black/40",
        "sm:rounded-2xl sm:border sm:border-[#e5e5e5] dark:sm:border-slate-800",
        heightClass
      )}
    >
      {/* Job header — Messenger-style top bar */}
      <header className="sticky top-0 z-10 shrink-0 border-b border-[#e5e5e5] bg-white px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-[#242526] sm:px-4 sm:py-3.5">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 text-base font-bold leading-tight tracking-tight text-[#050505] dark:text-gray-100 sm:text-[17px]">
              {jobTitle}
            </h2>
            <p className="mt-1 text-[15px] font-semibold text-[#0084ff] dark:text-sky-400">
              {agreedPriceLabel}
            </p>
          </div>
          <span className="max-w-[42%] shrink-0 rounded-full bg-[#e7f3ff] px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#0084ff] dark:bg-sky-950/80 dark:text-sky-300 sm:max-w-none sm:px-3 sm:text-[11px] sm:normal-case sm:tracking-normal">
            {statusPillLabel}
          </span>
        </div>
      </header>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="chat-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain px-2 py-3 [-webkit-overflow-scrolling:touch] sm:gap-1.5 sm:px-4 sm:py-4"
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
            const isMe = m.sender_id === currentUserId;
            const isListerSender = listerId && m.sender_id === listerId;
            const senderLabel =
              (isListerSender
                ? (listerName ?? "Lister").split(" ")[0]
                : (cleanerName ?? "Cleaner").split(" ")[0]) ?? "Partner";
            const avatarUrl = isListerSender ? listerAvatarUrl : cleanerAvatarUrl;
            const prev = messages[i - 1];
            const showAvatar =
              !isMe &&
              (!prev ||
                prev.sender_id !== m.sender_id ||
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
        sending={sending || uploadingImage}
        isOffline={isOffline}
        onPhotoSelected={(files) => void handlePhotoSelected(files)}
      />
      {error && (
        <p className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-[11px] text-destructive dark:bg-destructive/15">
          {error}
        </p>
      )}
    </div>
  );
}
