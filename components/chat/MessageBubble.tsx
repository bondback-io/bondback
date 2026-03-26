"use client";

import Image from "next/image";
import { Avatar } from "@/components/ui/avatar";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];

export type MessageBubbleProps = {
  message: JobMessageRow;
  isMe: boolean;
  showAvatar: boolean;
  avatarUrl: string | null;
  senderLabel: string;
  /** Persisted on server (not optimistic). */
  isDelivered: boolean;
  /** Other party read this outgoing message. */
  isRead?: boolean;
  /** Outgoing bubble: lister = blue, cleaner = green (matches chat shell). */
  accentRole?: "lister" | "cleaner" | null;
};

/**
 * Messenger-style bubbles: theirs left + avatar, mine right + blue bubble.
 * Read receipts: single tick (sending) → double gray (delivered) → double blue (read).
 */
export function MessageBubble({
  message,
  isMe,
  showAvatar,
  avatarUrl,
  senderLabel,
  isDelivered,
  isRead,
  accentRole = null,
}: MessageBubbleProps) {
  const imgUrl = message.image_url?.trim() || null;
  const meGreen = accentRole === "cleaner";

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
          <Avatar className="mt-1 h-10 w-10 shrink-0 border border-border/40 bg-muted shadow-sm dark:border-gray-600 sm:h-11 sm:w-11">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
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
            "flex min-w-0 max-w-[88%] flex-col gap-0.5 sm:gap-1",
            isMe ? "items-end" : "items-start"
          )}
        >
          <div
            className={cn(
              "rounded-[20px] px-3.5 py-2.5 text-[15px] leading-snug shadow-sm sm:rounded-[24px] sm:px-[18px] sm:py-3",
              isMe
                ? meGreen
                  ? "rounded-br-[6px] bg-emerald-600 text-white shadow-emerald-500/20 dark:bg-emerald-600"
                  : "rounded-br-[6px] bg-[#0084ff] text-white shadow-blue-500/15"
                : "rounded-bl-[6px] bg-[#e4e6eb] text-[#050505] dark:bg-[#303030] dark:text-[#f0f0f0]"
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
                    sizes="260px"
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

          <div
            className={cn(
              "flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground dark:text-gray-500",
              isMe && "justify-end"
            )}
          >
            {!isMe && (
              <span className="font-medium text-foreground/80 dark:text-gray-400">
                {senderLabel}
              </span>
            )}
            {isMe && (
              <span className="inline-flex items-center gap-0.5" aria-hidden>
                {!isDelivered ? (
                  <Check
                    className="h-3.5 w-3.5 text-white/85"
                    strokeWidth={2.5}
                    aria-label="Sending"
                  />
                ) : isRead ? (
                  <CheckCheck
                    className={cn(
                      "h-4 w-4",
                      meGreen ? "text-emerald-200" : "text-sky-200"
                    )}
                    strokeWidth={2.5}
                    aria-label="Read"
                  />
                ) : (
                  <CheckCheck
                    className="h-4 w-4 text-white/65"
                    strokeWidth={2.5}
                    aria-label="Delivered"
                  />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
