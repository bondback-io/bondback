"use client";

import { Lock } from "lucide-react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { cn } from "@/lib/utils";

export type JobChatMessengerProps = {
  jobTitle: string;
  agreedPriceLabel: string;
  statusPillLabel: string;
};

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
  /** Header labels — defaults if omitted */
  messenger?: JobChatMessengerProps;
  variant?: "default" | "compact";
  /** Extra classes on outer wrapper (e.g. full-bleed on mobile) */
  className?: string;
};

/**
 * One chat per job (job_id). Unlocks when escrow is active — server + RLS match `isChatUnlockedForJobStatus`.
 * Stays available after completion for reviews (completed is an unlock status).
 */
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
  messenger,
  variant = "default",
  className,
}: JobChatProps) {
  const m = messenger ?? {
    jobTitle: "Bond clean job",
    agreedPriceLabel: "—",
    statusPillLabel: "In progress",
  };

  if (!canChat) {
    return (
      <section
        id="job-chat"
        className={cn(
          "w-full overflow-hidden rounded-none border border-[#e5e5e5] bg-white shadow-md sm:rounded-2xl dark:border-slate-800 dark:bg-[#242526]",
          className
        )}
      >
        <div className="flex min-h-[200px] flex-col items-center justify-center px-6 py-12 text-center sm:min-h-[240px] sm:py-14">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#e7f3ff] dark:bg-slate-800">
            <Lock className="h-8 w-8 text-[#0084ff] dark:text-sky-400" aria-hidden />
          </div>
          <p className="text-lg font-bold text-[#050505] dark:text-gray-100">
            Chat is locked
          </p>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#65676b] dark:text-gray-400">
            Messaging opens once the lister has paid into escrow and the job is{" "}
            <span className="font-semibold text-[#050505] dark:text-gray-200">
              in progress
            </span>
            . Only you and your job partner can use this thread.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="job-chat" className={cn("w-full", className)}>
      <ChatWindow
        jobId={jobId}
        currentUserId={currentUserId}
        listerId={listerId}
        cleanerId={cleanerId}
        listerName={listerName}
        cleanerName={cleanerName}
        listerAvatarUrl={listerAvatarUrl}
        cleanerAvatarUrl={cleanerAvatarUrl}
        currentUserRole={currentUserRole}
        jobTitle={m.jobTitle}
        agreedPriceLabel={m.agreedPriceLabel}
        statusPillLabel={m.statusPillLabel}
        variant={variant}
      />
    </section>
  );
}
