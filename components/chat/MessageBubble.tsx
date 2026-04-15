"use client";

import { useState } from "react";
import Image from "next/image";
import { Avatar } from "@/components/ui/avatar";
import { Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { cn, trimStr } from "@/lib/utils";
import type { Database } from "@/types/supabase";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];

function formatChatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const datePart = format(d, "MMM d, yyyy");
  const timePart = format(d, "h:mm:ss a");
  let tz = "";
  try {
    tz =
      Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value?.trim() ?? "";
  } catch {
    tz = "";
  }
  return tz ? `${datePart}, ${timePart} ${tz}` : `${datePart}, ${timePart}`;
}

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
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const imgUrl = trimStr(message.image_url) || null;
  const senderIsLister = senderRole === "lister";
  const timeStr = formatChatMessageTime(message.created_at);
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
          "flex min-w-0 max-w-[min(94vw,22rem)] shrink gap-2 sm:max-w-[min(90vw,24rem)]",
          isMe ? "flex-row-reverse" : "flex-row"
        )}
      >
        {!isMe && showAvatar && (
          <Avatar className="mt-6 h-10 w-10 shrink-0 border border-border/40 bg-muted shadow-sm dark:border-gray-600 sm:h-11 sm:w-11">
            {avatarUrl ? (
              <OptimizedImage
                src={avatarUrl}
                alt=""
                width={44}
                height={44}
                sizes="44px"
                quality={75}
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
            "flex min-w-0 max-w-full flex-col gap-1 sm:gap-1.5",
            isMe ? "items-end" : "items-start"
          )}
        >
          <div
            className={cn(
              "flex w-full min-w-0 flex-col gap-0.5 px-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2 sm:gap-y-0.5",
              isMe ? "items-end sm:justify-end" : "items-start sm:justify-start"
            )}
          >
            <span className="max-w-full text-[11px] font-semibold leading-tight text-[#65676b] dark:text-gray-300">
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
              className="max-w-[min(100%,20rem)] text-[10px] leading-snug text-[#8a8d91] [word-break:break-word] dark:text-gray-400 sm:text-right sm:tabular-nums"
            >
              {timeStr}
            </time>
          </div>

          <div
            className={cn(
              "w-fit max-w-[min(85vw,20rem)] rounded-[20px] px-3.5 py-2.5 text-[15px] leading-snug shadow-sm sm:max-w-[min(75vw,24rem)] sm:rounded-[24px] sm:px-[18px] sm:py-3",
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
                  className="relative block h-44 w-full min-w-[200px] max-w-[260px] cursor-zoom-in sm:h-48"
                  onClick={() => setImagePreviewOpen(true)}
                  aria-label="View full size"
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
              <p className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] [text-wrap:pretty]">
                {message.message_text}
              </p>
            )}
            {message.message_text === "Photo" && !imgUrl && (
              <p className="text-sm opacity-90">Photo</p>
            )}
          </div>

          {imgUrl && (
            <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
              <DialogContent
                className={cn(
                  "max-h-[min(96vh,920px)] max-w-[min(96vw,1200px)] border-0 bg-transparent p-0 shadow-none",
                  "flex flex-col gap-0 overflow-visible sm:max-w-[min(96vw,1200px)]",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out"
                )}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DialogTitle className="sr-only">Photo preview</DialogTitle>
                <DialogDescription className="sr-only">
                  Full size image from chat. Close with the button, Escape, or by clicking outside.
                </DialogDescription>
                <div className="flex max-h-[min(90vh,880px)] w-full items-center justify-center px-2 pb-2 pt-10 sm:px-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- dynamic remote URL; large lightbox */}
                  <img
                    src={imgUrl}
                    alt=""
                    className="max-h-[min(85vh,820px)] w-auto max-w-full rounded-lg object-contain shadow-2xl"
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}

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
