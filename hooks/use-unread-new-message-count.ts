"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import {
  filterNotificationsForActiveRole,
  type ActiveRole,
} from "@/lib/notifications/notification-role-filter";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

/**
 * Unread `new_message` notifications for the current user, filtered by active role
 * (dual lister/cleaner accounts). Matches the bell / messages UX and survives refresh.
 */
export function useUnreadNewMessageCount(
  userId: string | null | undefined,
  activeRole: ActiveRole
): number {
  const [rows, setRows] = useState<NotificationRow[]>([]);

  const load = useCallback(async () => {
    if (!userId?.trim()) {
      setRows([]);
      return;
    }
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, is_read, message_text, job_id, created_at")
      .eq("user_id", userId)
      .eq("type", "new_message")
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) {
      setRows([]);
      return;
    }
    setRows((data ?? []) as NotificationRow[]);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId?.trim()) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`bb-unread-msg-nav-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 45_000);

    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId, load]);

  return useMemo(() => {
    return filterNotificationsForActiveRole(rows, activeRole).length;
  }, [rows, activeRole]);
}
