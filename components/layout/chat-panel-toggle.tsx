"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useChatPanel } from "@/components/chat/chat-panel-context";

export function ChatPanelToggle() {
  const { unreadTotal, toggleOpen, conversations } = useChatPanel();

  // Hide floating chat until there is at least one approved/active job conversation.
  if (!conversations || conversations.length === 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleOpen}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-muted bg-background text-muted-foreground shadow-sm hover:bg-muted dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
    >
      <MessageCircle className="h-4 w-4" />
      {unreadTotal > 0 && (
        <Badge className="absolute -right-1 -top-1 h-4 min-w-[18px] justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
          {unreadTotal > 9 ? "9+" : unreadTotal}
        </Badge>
      )}
    </button>
  );
}

