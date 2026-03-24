"use client";

import { useMemo } from "react";
import { useChatPanel } from "@/components/chat/chat-panel-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle } from "lucide-react";
import { JobChat } from "@/components/features/job-chat";
import { isChatUnlockedForJobStatus } from "@/lib/chat-unlock";
import { formatCents } from "@/lib/listings";
import { buildChatStatusPill } from "@/lib/chat-messenger-display";

export function FloatingChatPanel() {
  const {
    isOpen,
    isCollapsed,
    conversations,
    selectedJobId,
    selectJob,
    closePanel,
    toggleCollapsed,
    currentUserId,
  } = useChatPanel();

  const selected = useMemo(
    () => conversations.find((c) => c.jobId === selectedJobId) ?? null,
    [conversations, selectedJobId]
  );

  if (!isOpen) return null;

  const agreedLabel =
    selected && selected.agreedAmountCents != null && selected.agreedAmountCents > 0
      ? formatCents(selected.agreedAmountCents)
      : "—";

  const isLister =
    !!currentUserId && !!selected && currentUserId === selected.listerId;
  const isCleaner =
    !!currentUserId && !!selected && currentUserId === selected.cleanerId;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-end px-3 pb-3 sm:px-4 sm:pb-4">
      <div
        className={`flex max-h-[78vh] rounded-2xl border bg-background shadow-xl transition-all duration-200 dark:border-gray-800 dark:bg-gray-900 ${
          isCollapsed ? "w-[52px]" : "w-full max-w-4xl"
        }`}
      >
        {/* Collapse bar */}
        <div className="flex w-[48px] flex-col items-center justify-between border-r bg-muted/60 py-2 dark:border-gray-800 dark:bg-gray-800/80">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-xs shadow-sm hover:bg-muted dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={closePanel}
            className="text-[10px] text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-100"
          >
            Close
          </button>
        </div>

        {!isCollapsed && (
          <div className="flex flex-1 flex-col gap-3 p-2 sm:p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                Job messenger
              </p>
            </div>
            <div className="flex min-h-[280px] flex-1 gap-2">
              {/* Left: jobs list */}
              <div className="hidden w-1/3 flex-col gap-1 rounded-md border bg-background/70 p-2 text-xs dark:border-gray-800 dark:bg-gray-900/80 sm:flex">
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground dark:text-gray-400">
                  Active jobs
                </p>
                <ScrollArea className="flex-1">
                  <div className="space-y-1">
                    {conversations.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground dark:text-gray-500">
                        No active jobs to chat on yet.
                      </p>
                    ) : (
                      conversations.map((c) => {
                        const isSelected = c.jobId === selectedJobId;
                        const isOtherCleaner = c.otherPartyRole === "cleaner";
                        const baseName = isOtherCleaner
                          ? c.cleanerName ?? c.otherPartyName ?? "Cleaner"
                          : c.listerName ?? c.otherPartyName ?? "Owner";
                        const titleLine = `${baseName} ${
                          isOtherCleaner ? "(Cleaner)" : "(Owner)"
                        }`;
                        const baseTitle = c.listingTitle ?? "Bond clean job";
                        const secondLine = baseTitle.split(" in ")[0] ?? baseTitle;
                        return (
                          <button
                            key={c.jobId}
                            type="button"
                            onClick={() => selectJob(c.jobId)}
                            className={`w-full rounded-md border px-2 py-1.5 text-left text-[11px] transition dark:border-gray-700 ${
                              isSelected
                                ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/40"
                                : "border-border bg-background hover:bg-muted/70 dark:bg-gray-800 dark:hover:bg-gray-700"
                            }`}
                          >
                            <p className="line-clamp-1 font-semibold text-foreground dark:text-gray-100">
                              {titleLine}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground dark:text-gray-400">
                              {secondLine}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Right: chat window */}
              <div className="flex w-full flex-1 min-w-0 flex-col">
                {!selected || !currentUserId ? (
                  <Card className="flex h-[260px] flex-1 items-center justify-center text-[11px] text-muted-foreground dark:text-gray-400">
                    <p>Select a job from the left to start chatting.</p>
                  </Card>
                ) : (
                  <JobChat
                    jobId={selected.jobId}
                    currentUserId={currentUserId}
                    canChat={isChatUnlockedForJobStatus(selected.status)}
                    currentUserRole={
                      isLister ? "lister" : isCleaner ? "cleaner" : null
                    }
                    listerId={selected.listerId}
                    cleanerId={selected.cleanerId}
                    listerName={selected.listerName}
                    cleanerName={selected.cleanerName}
                    listerAvatarUrl={selected.listerAvatarUrl}
                    cleanerAvatarUrl={selected.cleanerAvatarUrl}
                    variant="compact"
                    messenger={{
                      jobTitle: selected.listingTitle ?? "Bond clean job",
                      agreedPriceLabel: agreedLabel,
                      statusPillLabel: buildChatStatusPill({
                        status: selected.status,
                        hasPaymentHold: selected.hasPaymentHold,
                        autoReleaseAt: selected.autoReleaseAt,
                      }),
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
