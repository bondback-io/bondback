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
}: ChatInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);

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
        "shrink-0 border-t border-[#e5e5e5] bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]",
        "dark:border-slate-800 dark:bg-[#0f0f0f] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35]"
      )}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2 px-2 pb-1 sm:gap-3 sm:px-4 sm:pb-2">
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
          className="mb-0.5 h-11 w-11 shrink-0 rounded-full text-[#0084ff] hover:bg-[#0084ff]/10 touch-manipulation sm:h-12 sm:w-12 dark:text-sky-400 dark:hover:bg-sky-500/15"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach photo"
        >
          <ImagePlus className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />
        </Button>
        <div className="relative min-h-[48px] flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isOffline ? "Reconnect to send…" : placeholder}
            maxLength={500}
            disabled={sending || disabled || isOffline}
            className={cn(
              "min-h-[48px] w-full rounded-[24px] border-0 bg-[#f0f2f5] px-4 py-3 text-[16px] leading-tight outline-none ring-0 transition-shadow",
              "placeholder:text-[#65676b] focus:bg-[#e8eaef] focus:ring-2 focus:ring-[#0084ff]/25",
              "dark:bg-[#2a2a2a] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-[#333] dark:focus:ring-sky-500/30",
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
          className="mb-0.5 h-11 w-11 shrink-0 rounded-full bg-[#0084ff] text-white shadow-md hover:bg-[#0073e6] disabled:opacity-40 touch-manipulation sm:h-12 sm:w-12 dark:bg-sky-600 dark:hover:bg-sky-500"
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
