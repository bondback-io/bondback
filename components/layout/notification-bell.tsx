"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
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
import type { ActiveRole } from "@/lib/notifications/notification-role-filter";
import {
  filterNotificationsForActiveRole,
} from "@/lib/notifications/notification-role-filter";
import { useNotificationsInfinite } from "@/hooks/use-notifications-infinite";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notification-count";
import {
  decrementUnreadCountCache,
  invalidateUnreadCountsForUser,
  setUnreadCountCacheZero,
} from "@/lib/notifications/unread-count-cache";
import {
  getNotificationBody,
  getNotificationTitle,
  getNotificationHref,
} from "@/lib/notifications/display";
import { triggerInAppNotificationFeedback } from "@/lib/notifications/in-app-notification-feedback";

const PEEK = 15;

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export type NotificationBellProps = {
  userId: string;
  activeRole?: ActiveRole;
  variant?: "icon" | "row";
  /** From `profiles.notification_preferences`; default ON when omitted. */
  inAppSoundEnabled?: boolean;
  inAppVibrateEnabled?: boolean;
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

export function NotificationBell({
  userId,
  activeRole = null,
  variant = "icon",
  inAppSoundEnabled = true,
  inAppVibrateEnabled = true,
}: NotificationBellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const bellMenuOpenRef = useRef(false);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const {
    flat,
    isPending,
    optimisticMarkRead,
    optimisticMarkAllRead,
    refetch,
  } = useNotificationsInfinite(userId);

  const role = activeRole ?? null;
  const { data: unreadFromServer = 0 } = useUnreadNotificationCount(userId, role);

  const displayedNotifications = useMemo(
    () => filterNotificationsForActiveRole(flat, activeRole ?? null),
    [flat, activeRole]
  );

  const peekList = useMemo(
    () => displayedNotifications.slice(0, PEEK),
    [displayedNotifications]
  );

  const unreadCount = unreadFromServer;

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`notifications-toast-${userId}`)
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
          if (process.env.NODE_ENV === "development") {
            console.info("[notifications:toast-channel]", {
              id: row.id,
              type: row.type,
              userId: row.user_id,
            });
          }
          const visibleForRole =
            filterNotificationsForActiveRole([row], activeRole ?? null).length > 0;
          if (!visibleForRole) {
            if (process.env.NODE_ENV === "development") {
              console.info("[notifications:toast-skip-role]", { id: row.id, type: row.type });
            }
            return;
          }
          const isDisputeNotif = row.type === "dispute_opened" || row.type === "dispute_resolved";
          const title =
            getNotificationTitle(row) ||
            (row.type === "new_message" && row.job_id != null
              ? `New message in Job #${row.job_id}`
              : isDisputeNotif && row.job_id != null
                ? `Dispute update on Job #${row.job_id}`
                : row.type === "job_completed" && row.job_id != null
                  ? `Job #${row.job_id} marked complete`
                  : labelForType(row.type));
          const msg = getNotificationBody(row);
          const href = getNotificationHref(row);
          toastRef.current({
            title,
            description: msg.length > 80 ? `${msg.slice(0, 77)}…` : msg || "You have a new notification.",
            action: href
              ? {
                  label: "View",
                  href,
                }
              : undefined,
          });

          const path = pathnameRef.current;
          const isNotificationsRoute =
            path === "/notifications" || path.startsWith("/notifications/");
          triggerInAppNotificationFeedback({
            soundEnabled: inAppSoundEnabled,
            vibrateEnabled: inAppVibrateEnabled,
            bellMenuOpen: bellMenuOpenRef.current,
            isNotificationsRoute,
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, activeRole, inAppSoundEnabled, inAppVibrateEnabled]);

  const handleClickNotification = async (n: NotificationRow) => {
    if (!n.is_read) {
      optimisticMarkRead(n.id);
      decrementUnreadCountCache(queryClient, userId, role);
      const res = await markNotificationRead(n.id);
      if (res.ok && process.env.NODE_ENV === "development") {
        console.info("[notifications:bell-mark-read]", { id: n.id });
      }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn’t mark read",
          description: res.error,
        });
        void refetch();
        void invalidateUnreadCountsForUser(queryClient, userId);
      }
    }
    const href = getNotificationHref(n);
    router.push(href ?? "/dashboard");
  };

  const handleMarkAll = async () => {
    optimisticMarkAllRead();
    setUnreadCountCacheZero(queryClient, userId, role);
    const res = await markAllNotificationsRead();
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Couldn’t update",
        description: res.error,
      });
      void refetch();
      void invalidateUnreadCountsForUser(queryClient, userId);
    }
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
    <DropdownMenu
      onOpenChange={(open) => {
        bellMenuOpenRef.current = open;
        if (open && unreadCount > 0) {
          void handleMarkAll();
        }
      }}
    >
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
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount > 9 ? "9+" : unreadCount} unread`
              : "Notifications"
          }
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
              onClick={() => void handleMarkAll()}
            >
              Mark all read
            </Button>
          )}
        </div>
        <DropdownSep />
        {isPending && flat.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : peekList.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No new notifications
          </div>
        ) : (
          <ScrollArea className="h-[min(60vh,320px)]">
            <div className="p-1">
              {peekList.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => void handleClickNotification(n)}
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
                          {getNotificationTitle(n)}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-foreground dark:text-gray-100">
                        {getNotificationBody(n)}
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
