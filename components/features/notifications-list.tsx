"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  MessageSquare,
  Briefcase,
  AlertTriangle,
  DollarSign,
  Megaphone,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { markNotificationRead } from "@/lib/actions/notifications";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

function iconForType(type: NotificationRow["type"]) {
  switch (type) {
    case "new_message":
      return <MessageSquare className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />;
    case "job_created":
    case "job_accepted":
    case "job_completed":
      return <Briefcase className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    case "payment_released":
      return <DollarSign className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    case "dispute_opened":
    case "dispute_resolved":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />;
    case "new_bid":
      return <Megaphone className="h-4 w-4 shrink-0 text-primary" />;
    default:
      return <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}

function labelForType(type: NotificationRow["type"]): string {
  switch (type) {
    case "job_accepted": return "Job accepted";
    case "new_message": return "New message";
    case "job_completed": return "Job completed";
    case "payment_released": return "Payment released";
    case "dispute_opened": return "Dispute opened";
    case "dispute_resolved": return "Dispute resolved";
    case "job_created": return "Job created";
    case "new_bid": return "New bid";
    default: return "Update";
  }
}

export function NotificationsList({
  initialNotifications,
  currentUserId,
}: {
  initialNotifications: NotificationRow[];
  currentUserId: string;
}) {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-page-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as NotificationRow, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId]);

  const handleClick = async (n: NotificationRow) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      );
    }
    if (n.job_id) {
      const isDispute = n.type === "dispute_opened" || n.type === "dispute_resolved";
      router.push(isDispute ? `/jobs/${n.job_id}#dispute` : `/jobs/${n.job_id}`);
    } else router.push("/dashboard");
  };

  if (notifications.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No notifications yet.
      </p>
    );
  }

  return (
    <ScrollArea className="h-[60vh]">
      <ul className="space-y-1 pr-2">
        {notifications.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => handleClick(n)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                !n.is_read && "border-primary/30 bg-muted/40 dark:bg-gray-800/40"
              )}
            >
              {iconForType(n.type)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {labelForType(n.type)}
                    {n.job_id != null && ` · Job #${n.job_id}`}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-foreground dark:text-gray-100">
                  {n.message_text}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
