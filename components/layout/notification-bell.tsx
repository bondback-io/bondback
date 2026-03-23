"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator as DropdownSep,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const RECENT_LIMIT = 15;

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export type NotificationBellProps = {
  userId: string;
  variant?: "icon" | "row";
};

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
    case "job_accepted":
      return "Job accepted";
    case "new_message":
      return "New message";
    case "job_completed":
      return "Job completed";
    case "payment_released":
      return "Payment released";
    case "dispute_opened":
      return "Dispute opened";
    case "dispute_resolved":
      return "Dispute resolved";
    case "job_created":
      return "Job created";
    case "new_bid":
      return "New bid";
    default:
      return "Update";
  }
}

export function NotificationBell({ userId, variant = "icon" }: NotificationBellProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const routerRef = useRef(router);
  routerRef.current = router;

  const loadNotifications = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT);
    if (error) {
      const isTableMissing =
        error.message?.includes("schema cache") ||
        error.message?.includes("could not find the table") ||
        error.message?.includes("relation \"public.notifications\" does not exist");
      if (!isTableMissing && process.env.NODE_ENV === "development") {
        console.warn("[NotificationBell] load error:", error.message);
      }
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    if (data) {
      setNotifications(data as NotificationRow[]);
      setUnreadCount(data.filter((n) => !(n as NotificationRow).is_read).length);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    void loadNotifications();

    // Poll while tab is visible — backup when Realtime publication is not enabled or channel errors.
    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible" && !cancelled) void loadNotifications();
    }, 45_000);

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          setNotifications((prev) => [row, ...prev].slice(0, RECENT_LIMIT));
          setUnreadCount((prev) => prev + (row.is_read ? 0 : 1));
          routerRef.current.refresh();
          const isDisputeNotif = row.type === "dispute_opened" || row.type === "dispute_resolved";
          const title =
            row.type === "new_message" && row.job_id != null
              ? `New message in Job #${row.job_id}`
              : isDisputeNotif && row.job_id != null
                ? `Dispute update on Job #${row.job_id}`
                : row.type === "job_completed" && row.job_id != null
                  ? `Job #${row.job_id} marked complete`
                  : labelForType(row.type);
          const msg = row.message_text ?? "";
          toastRef.current({
            title,
            description: msg.length > 80 ? `${msg.slice(0, 77)}…` : msg || "You have a new notification.",
            action:
              row.job_id != null
                ? { label: "View", href: isDisputeNotif ? `/jobs/${row.job_id}#dispute` : `/jobs/${row.job_id}` }
                : undefined,
          });
        }
      )
      .subscribe((status, err) => {
        if (process.env.NODE_ENV === "development") {
          if (status === "SUBSCRIBED") {
            // eslint-disable-next-line no-console
            console.debug("[NotificationBell] realtime subscribed");
          }
          if (status === "CHANNEL_ERROR" || err) {
            console.warn("[NotificationBell] realtime channel error — polling will still refresh notifications", err);
          }
        }
      });

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  const handleClickNotification = async (n: NotificationRow) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    if (n.job_id) {
      const isDispute = n.type === "dispute_opened" || n.type === "dispute_resolved";
      router.push(isDispute ? `/jobs/${n.job_id}#dispute` : `/jobs/${n.job_id}`);
    } else {
      router.push("/dashboard");
    }
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const triggerContent =
    variant === "row" ? (
      <span className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-foreground transition-transform active:scale-[0.98] hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100">
        <Bell className="h-5 w-5 shrink-0" />
        <span>Notifications</span>
        {unreadCount > 0 && (
          <Badge className="ml-auto bg-destructive px-1.5 text-[10px]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </span>
    ) : (
      <>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -right-1 -top-1 bg-destructive px-1 text-[10px]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={variant === "row" ? "default" : "icon"}
          className={cn(
            variant === "row" && "h-auto w-full justify-start p-0",
            "relative shrink-0 cursor-pointer",
            variant !== "row" && "mr-0.5 sm:mr-1"
          )}
          aria-label="Notifications"
          aria-haspopup="menu"
        >
          {triggerContent}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[100] w-[360px] p-0"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto text-xs text-primary hover:underline"
              onClick={handleMarkAll}
            >
              Mark all read
            </Button>
          )}
        </div>
        <DropdownSep />
        {loading ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No new notifications
          </div>
        ) : (
          <ScrollArea className="h-[min(60vh,320px)]">
            <div className="p-1">
              {notifications.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-1 rounded-md px-3 py-2.5 text-left focus:bg-muted",
                    !n.is_read && "bg-muted/60 dark:bg-gray-800/60"
                  )}
                >
                  <div className="flex w-full items-start gap-2">
                    {iconForType(n.type)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {labelForType(n.type)}
                          {n.job_id != null && ` · Job #${n.job_id}`}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-foreground dark:text-gray-100">
                        {n.message_text}
                      </p>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          </ScrollArea>
        )}
        <DropdownSep />
        <div className="p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <Link href="/notifications">View all notifications</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
