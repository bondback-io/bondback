"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Lock } from "lucide-react";
import { sendJobMessage } from "@/lib/actions/job-messages";
import { useIsOffline } from "@/hooks/use-offline";
import { useToast } from "@/components/ui/use-toast";

type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];

export type JobChatProps = {
  jobId: number;
  currentUserId: string;
  canChat: boolean;
  currentUserRole: "lister" | "cleaner" | null;
  listerId: string | null;
  cleanerId: string | null;
  listerName: string | null;
  cleanerName: string | null;
   listerAvatarUrl: string | null;
   cleanerAvatarUrl: string | null;
};

export function JobChat({
  jobId,
  currentUserId,
  canChat,
  currentUserRole,
  listerId,
  cleanerId,
  listerName,
  cleanerName,
  listerAvatarUrl,
  cleanerAvatarUrl,
}: JobChatProps) {
  const supabase = createBrowserSupabaseClient();
  const { toast } = useToast();
  const isOffline = useIsOffline();
  const [messages, setMessages] = useState<JobMessageRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);

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

    load();

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
          setMessages((prev) => [...prev, payload.new as JobMessageRow]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, jobId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (canChat) {
      setJustUnlocked(true);
      const t = setTimeout(() => setJustUnlocked(false), 2500);
      return () => clearTimeout(t);
    }
  }, [canChat]);

  // Cross-instance sync: when any JobChat sends a message, it broadcasts a
  // window event. Listen and append if it's for this job and from another user.
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
      setMessages((prev) => [...prev, message]);
    };
    window.addEventListener("bondback:job-message-sent", handler as EventListener);
    return () => {
      window.removeEventListener(
        "bondback:job-message-sent",
        handler as EventListener
      );
    };
  }, [jobId, currentUserId]);

  const handleSend = async () => {
    setError(null);
    if (isOffline) {
      toast({ title: "Offline", description: "Reconnect to perform this action.", variant: "destructive" });
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
    // Create a lightweight local message object for optimistic UI.
    const optimistic: JobMessageRow = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      id: (Math.random().toString(36).slice(2) + nowIso) as any,
      job_id: jobId,
      sender_id: currentUserId,
      message_text: trimmed,
      created_at: nowIso,
    };

    // Optimistically append the message so the sender sees it immediately,
    // even if realtime is slightly delayed.
    setMessages((prev) => [...prev, optimistic]);

    // Also broadcast a browser-level event so any other open JobChat
    // instances for this job (e.g. /messages page + floating panel)
    // can append the message without waiting on realtime.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("bondback:job-message-sent", {
          detail: {
            jobId,
            message: optimistic,
          },
        })
      );
    }
    setText("");
  };

  if (!canChat) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/40 p-6 text-center text-xs text-muted-foreground dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted dark:bg-gray-800">
          <Lock className="h-6 w-6 text-muted-foreground dark:text-gray-400" />
        </div>
        <p className="text-sm font-medium text-foreground dark:text-gray-100">
          Chat will unlock once both parties accept the job.
        </p>
        <p className="mt-1 max-w-md dark:text-gray-300">
          Use the Accept Job buttons above to confirm, then you&apos;ll be able
          to coordinate dates, share photos, and keep everything securely inside
          Bond Back.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[340px] flex-col rounded-lg border bg-background text-xs shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:h-[380px]">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
        <div className="flex flex-col">
          <p className="text-sm font-semibold">Job messenger</p>
          <p className="text-[11px] text-muted-foreground dark:text-gray-400">
            Chat between{" "}
            <span className="font-medium">
              {(listerName ?? "Lister").split(" ")[0]}
            </span>{" "}
            &amp;{" "}
            <span className="font-medium">
              {(cleanerName ?? "Cleaner").split(" ")[0]}
            </span>
            .
          </p>
        </div>
      </div>

      {justUnlocked && (
        <div className="animate-in fade-in slide-in-from-top-1 border-b bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
          Chat unlocked. You can now coordinate dates, access, and expectations here.
        </div>
      )}

      <ScrollArea
        ref={scrollRef}
        className="flex-1 px-3 py-3"
      >
        {messages.length === 0 ? (
          <p className="mt-4 text-center text-muted-foreground dark:text-gray-400">
            No messages yet. Say hi and coordinate your bond clean details here.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => {
              const isMe = m.sender_id === currentUserId;
              const isListerSender = listerId && m.sender_id === listerId;
              const senderFirstName = isListerSender
                ? (listerName ?? "Lister").split(" ")[0]
                : (cleanerName ?? "Cleaner").split(" ")[0];

              const avatarUrl = isListerSender
                ? listerAvatarUrl
                : cleanerAvatarUrl;
              const roleLetter = isListerSender ? "L" : "C";

              const createdDate = new Date(m.created_at);
              const diffMs = Date.now() - createdDate.getTime();
              const diffMin = Math.round(diffMs / 60000);
              const relative =
                diffMin < 1
                  ? "Just now"
                  : diffMin < 60
                    ? `${diffMin} min ago`
                    : `${Math.floor(diffMin / 60)} hr ago`;

              return (
                <div
                  key={m.id}
                  className={`flex w-full gap-2 ${
                    isMe ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isMe && (
                    <Avatar className="mt-1 h-7 w-7 bg-muted text-[11px] font-medium text-foreground">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt={senderFirstName}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        roleLetter
                      )}
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] ${
                      isMe ? "items-end" : "items-start"
                    } flex flex-col gap-1`}
                  >
                    <div
                      className={`rounded-2xl px-3 py-2 ${
                        isListerSender
                          ? "bg-muted text-foreground dark:bg-gray-800 dark:text-gray-100"
                          : "bg-emerald-600 text-white dark:bg-blue-900/80 dark:text-blue-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-xs">
                        {m.message_text}
                      </p>
                    </div>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground dark:text-gray-500">
                      <span className="font-medium">
                        {senderFirstName}
                      </span>
                      <span>·</span>
                      <span>{relative}</span>
                    </p>
                  </div>
                  {isMe && (
                    <Avatar className="mt-1 h-7 w-7 bg-emerald-600 text-[11px] font-medium text-white dark:bg-blue-800">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt={senderFirstName}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        roleLetter
                      )}
                    </Avatar>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="border-t bg-background px-3 py-2 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending && text.trim().length > 0) {
                  void handleSend();
                }
              }
            }}
            placeholder="Type a message (kept securely inside Bond Back)…"
            maxLength={500}
            disabled={sending}
            className="text-xs sm:text-sm"
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="px-3 text-xs sm:px-4 sm:text-sm"
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
        {error && (
          <p className="mt-1 text-[11px] text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

