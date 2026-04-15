"use client";

import { useRef, type KeyboardEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatInputProps = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled?: boolean;
  isOffline?: boolean;
  onPhotoSelected?: (files: FileList | null) => void;
  placeholder?: string;
  /** Lister = blue accents, Cleaner = green — matches messages page chat shell. */
  accentRole?: "lister" | "cleaner" | null;
};

/**
 * Fixed bottom bar: large pill input, send, photo — optimized for thumbs (mobile-first).
 */
export function ChatInput({
  value,
  onChange,
  onSend,
  sending,
  disabled,
  isOffline,
  onPhotoSelected,
  placeholder = "Aa",
  accentRole = null,
}: ChatInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isLister = accentRole === "lister";
  const isCleaner = accentRole === "cleaner";
  const accentPhoto =
    isCleaner
      ? "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
      : "text-[#0084ff] hover:bg-[#0084ff]/10 dark:text-sky-400 dark:hover:bg-sky-500/15";
  const accentSend =
    isCleaner
      ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
      : "bg-[#0084ff] hover:bg-[#0073e6] dark:bg-sky-600 dark:hover:bg-sky-500";
  const inputFocus =
    isCleaner
      ? "focus:ring-emerald-500/30 dark:focus:ring-emerald-500/35"
      : "focus:ring-[#0084ff]/25 dark:focus:ring-sky-500/30";

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending && value.trim().length > 0 && !disabled) {
        onSend();
      }
    }
  };

  return (
    <div
      className={cn(
        "shrink-0 border-t pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]",
        isCleaner
          ? "border-emerald-200/80 bg-white/95 dark:border-emerald-900/50 dark:bg-emerald-950/40"
          : isLister
            ? "border-sky-200/80 bg-white/95 dark:border-sky-900/40 dark:bg-slate-900/90"
            : "border-[#e5e5e5] bg-white dark:border-slate-800 dark:bg-[#0f0f0f]",
        "dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)]"
      )}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-1.5 px-2 pb-1 sm:gap-2.5 sm:px-3 sm:pb-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            onPhotoSelected?.(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || sending || isOffline}
          className={cn(
            "mb-0.5 h-11 w-11 shrink-0 rounded-full touch-manipulation sm:h-12 sm:w-12",
            accentPhoto
          )}
          onClick={() => fileRef.current?.click()}
          aria-label="Attach photo"
        >
          <ImagePlus className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />
        </Button>
        <div className="relative min-h-[46px] flex-1 sm:min-h-[48px]">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isOffline ? "Reconnect to send…" : placeholder}
            maxLength={500}
            disabled={sending || disabled || isOffline}
            style={{ fontSize: "16px" }}
            className={cn(
              "min-h-[46px] w-full rounded-[22px] border-0 bg-[#f0f2f5] px-3.5 py-2.5 leading-tight outline-none ring-0 transition-shadow sm:min-h-[48px] sm:rounded-[24px] sm:px-4 sm:py-3 sm:text-base",
              "placeholder:text-[#65676b] focus:bg-[#e8eaef] focus:ring-2",
              inputFocus,
              isCleaner &&
                "bg-emerald-50/80 focus:bg-emerald-50 dark:bg-emerald-950/35 dark:focus:bg-emerald-950/50",
              isLister &&
                !isCleaner &&
                "bg-sky-50/60 focus:bg-sky-100/50 dark:bg-slate-800/90 dark:focus:bg-slate-800",
              !isCleaner &&
                !isLister &&
                "dark:bg-[#2a2a2a] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-[#333]",
              isLister &&
                !isCleaner &&
                "dark:text-slate-100 dark:placeholder:text-slate-500",
              (sending || disabled || isOffline) && "opacity-55"
            )}
            autoComplete="off"
            autoCorrect="on"
            enterKeyHint="send"
          />
        </div>
        <Button
          type="button"
          size="icon"
          disabled={sending || !value.trim() || disabled || isOffline}
          className={cn(
            "mb-0.5 h-11 w-11 shrink-0 rounded-full text-white shadow-md disabled:opacity-40 touch-manipulation sm:h-12 sm:w-12",
            accentSend
          )}
          onClick={onSend}
          aria-label="Send message"
        >
          {sending ? (
            <span className="text-base animate-pulse">…</span>
          ) : (
            <Send className="h-5 w-5 sm:h-6 sm:w-6" />
          )}
        </Button>
      </div>
    </div>
  );
}
