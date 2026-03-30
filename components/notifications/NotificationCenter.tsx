"use client";

/**
 * Full-page notification list. New-row chime/vibration is triggered from
 * `NotificationBell` (same realtime INSERT) and skipped when `/notifications` is open.
 */

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  MessageSquare,
  Briefcase,
  AlertTriangle,
  DollarSign,
  Megaphone,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { ActiveRole } from "@/lib/notifications/notification-role-filter";
import { filterNotificationsForActiveRole } from "@/lib/notifications/notification-role-filter";
import type { Database } from "@/types/supabase";
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
import { useToast } from "@/components/ui/use-toast";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

function iconForType(type: NotificationRow["type"]) {
  switch (type) {
    case "new_message":
      return <MessageSquare className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />;
    case "job_created":
    case "job_accepted":
    case "job_completed":
    case "job_approved_to_start":
    case "after_photos_uploaded":
    case "checklist_all_complete":
    case "job_status_update":
      return <Briefcase className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    case "listing_live":
    case "new_job_in_area":
      return <Megaphone className="h-4 w-4 shrink-0 text-primary" />;
    case "daily_digest":
      return <Bell className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />;
    case "auto_release_warning":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />;
    case "payment_released":
    case "funds_ready":
      return <DollarSign className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    case "dispute_opened":
    case "dispute_resolved":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />;
    case "new_bid":
      return <Megaphone className="h-4 w-4 shrink-0 text-primary" />;
    case "early_accept_declined":
      return <Briefcase className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" />;
    default:
      return <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}

export function NotificationCenter({
  currentUserId,
  activeRole = null,
  initialNotifications,
}: {
  currentUserId: string;
  activeRole?: ActiveRole;
  initialNotifications: NotificationRow[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const role = activeRole ?? null;
  const { data: unreadFromServer = 0 } = useUnreadNotificationCount(currentUserId, role);
  const {
    flat,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    error,
    optimisticMarkRead,
    optimisticMarkAllRead,
    refetch,
  } = useNotificationsInfinite(currentUserId, initialNotifications);

  const displayed = filterNotificationsForActiveRole(flat, activeRole ?? null);

  const handleClick = async (n: NotificationRow) => {
    if (!n.is_read) {
      optimisticMarkRead(n.id);
      decrementUnreadCountCache(queryClient, currentUserId, role);
      const res = await markNotificationRead(n.id);
      if (res.ok && process.env.NODE_ENV === "development") {
        console.info("[notifications:center-mark-read]", { id: n.id });
      }
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn’t mark read", description: res.error });
        void refetch();
        void invalidateUnreadCountsForUser(queryClient, currentUserId);
      }
    }
    const href = getNotificationHref(n);
    router.push(href ?? "/dashboard");
  };

  const handleMarkAll = async () => {
    optimisticMarkAllRead();
    setUnreadCountCacheZero(queryClient, currentUserId, role);
    const res = await markAllNotificationsRead();
    if (!res.ok) {
      toast({ variant: "destructive", title: "Couldn’t update", description: res.error });
      void refetch();
      void invalidateUnreadCountsForUser(queryClient, currentUserId);
    }
  };

  const unread = unreadFromServer;

  if (isPending && flat.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading notifications…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3 py-8 text-center text-sm">
        <p className="text-destructive">{error?.message ?? "Failed to load"}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (displayed.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No notifications yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </p>
        {unread > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-full text-xs"
            onClick={() => void handleMarkAll()}
          >
            Mark all as read
          </Button>
        )}
      </div>

      <ScrollArea className="h-[min(70dvh,560px)] pr-2">
        <ul className="space-y-1.5 pb-4">
          {displayed.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => void handleClick(n)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors active:scale-[0.99]",
                  "border-border/80 hover:bg-muted/50 dark:border-gray-800 dark:hover:bg-gray-800/50",
                  !n.is_read && "border-primary/25 bg-primary/[0.06] dark:bg-gray-800/60"
                )}
              >
                {iconForType(n.type)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-snug text-foreground dark:text-gray-100">
                      {getNotificationTitle(n)}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground dark:text-gray-400">
                    {getNotificationBody(n)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>

      {hasNextPage && (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              "Load older notifications"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
