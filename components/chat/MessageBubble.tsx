"use client";

import Image from "next/image";
import { Avatar } from "@/components/ui/avatar";
import { Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];

export type MessageBubbleProps = {
  message: JobMessageRow;
  isMe: boolean;
  showAvatar: boolean;
  avatarUrl: string | null;
  /** First name (or short label) of the person who sent this message. */
  senderLabel: string;
  /** Who sent this message — drives bubble colour (lister = blue, cleaner = green). */
  senderRole: "lister" | "cleaner";
  /** Persisted on server (not optimistic). */
  isDelivered: boolean;
  /** Other party read this outgoing message. */
  isRead?: boolean;
};

/**
 * Lister messages = blue bubble, cleaner messages = green bubble.
 * Read receipts: single tick (sending) → double (delivered) → double lighter (read).
 */
export function MessageBubble({
  message,
  isMe,
  showAvatar,
  avatarUrl,
  senderLabel,
  senderRole,
  isDelivered,
  isRead,
}: MessageBubbleProps) {
  const imgUrl = message.image_url?.trim() || null;
  const senderIsLister = senderRole === "lister";
  const timeStr = format(new Date(message.created_at), "h:mm a");
  const roleHint = senderIsLister ? "Lister" : "Cleaner";
  const bubbleRounded = isMe ? "rounded-br-[6px]" : "rounded-bl-[6px]";
  const bubbleColor = senderIsLister
    ? cn(
        bubbleRounded,
        "bg-[#1877f2] text-white shadow-blue-600/25 ring-1 ring-white/10 dark:bg-[#2563eb]"
      )
    : cn(
        bubbleRounded,
        "bg-emerald-500 text-white shadow-emerald-700/20 ring-1 ring-white/10 dark:bg-emerald-500"
      );

  return (
    <div
      className={cn(
        "flex w-full touch-pan-y",
        isMe ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex max-w-[min(92%,20rem)] gap-2 sm:max-w-[min(88%,22rem)]",
          isMe ? "flex-row-reverse" : "flex-row"
        )}
      >
        {!isMe && showAvatar && (
          <Avatar className="mt-6 h-10 w-10 shrink-0 border border-border/40 bg-muted shadow-sm dark:border-gray-600 sm:h-11 sm:w-11">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-semibold">
                {senderLabel.slice(0, 1).toUpperCase()}
              </span>
            )}
          </Avatar>
        )}
        {!isMe && !showAvatar && <div className="w-10 shrink-0 sm:w-11" aria-hidden />}

        <div
          className={cn(
            "flex min-w-0 max-w-[88%] flex-col gap-1 sm:gap-1.5",
            isMe ? "items-end" : "items-start"
          )}
        >
          <div
            className={cn(
              "flex w-full max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5 px-0.5",
              isMe ? "justify-end" : "justify-start"
            )}
          >
            <span className="min-w-0 max-w-[min(100%,12rem)] truncate text-[11px] font-semibold leading-tight text-[#65676b] dark:text-gray-300 sm:max-w-[14rem]">
              {isMe ? (
                <>
                  You
                  <span className="ml-1 font-normal opacity-80">({roleHint})</span>
                </>
              ) : (
                <>
                  {senderLabel}
                  <span className="ml-1 font-normal opacity-80">({roleHint})</span>
                </>
              )}
            </span>
            <time
              dateTime={message.created_at}
              className="shrink-0 text-[10px] tabular-nums text-[#8a8d91] dark:text-gray-400"
            >
              {timeStr}
            </time>
          </div>

          <div
            className={cn(
              "rounded-[20px] px-3.5 py-2.5 text-[15px] leading-snug shadow-sm sm:rounded-[24px] sm:px-[18px] sm:py-3",
              bubbleColor
            )}
          >
            {imgUrl && (
              <div
                className={cn(
                  "relative mb-2 overflow-hidden rounded-2xl",
                  message.message_text &&
                    message.message_text !== "Photo" &&
                    "mb-2"
                )}
              >
                <button
                  type="button"
                  className="relative block h-44 w-full min-w-[200px] max-w-[260px] sm:h-48"
                  onClick={() =>
                    window.open(imgUrl, "_blank", "noopener,noreferrer")
                  }
                >
                  <Image
                    src={imgUrl}
                    alt="Attachment"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) min(92vw, 260px), 260px"
                    loading="lazy"
                    unoptimized
                  />
                </button>
              </div>
            )}
            {message.message_text && message.message_text !== "Photo" && (
              <p className="whitespace-pre-wrap break-words">{message.message_text}</p>
            )}
            {message.message_text === "Photo" && !imgUrl && (
              <p className="text-sm opacity-90">Photo</p>
            )}
          </div>

          {isMe && (
            <div
              className={cn(
                "flex items-center gap-1 px-0.5 text-[11px] text-[#65676b] dark:text-gray-500",
                "justify-end"
              )}
            >
              <span className="inline-flex items-center gap-0.5" aria-hidden>
                {!isDelivered ? (
                  <Check
                    className="h-3.5 w-3.5 text-[#65676b] dark:text-gray-400"
                    strokeWidth={2.5}
                    aria-label="Sending"
                  />
                ) : isRead ? (
                  <CheckCheck
                    className={cn(
                      "h-4 w-4",
                      senderIsLister ? "text-sky-500 dark:text-sky-400" : "text-emerald-600 dark:text-emerald-400"
                    )}
                    strokeWidth={2.5}
                    aria-label="Read"
                  />
                ) : (
                  <CheckCheck
                    className="h-4 w-4 text-[#65676b] dark:text-gray-400"
                    strokeWidth={2.5}
                    aria-label="Delivered"
                  />
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
