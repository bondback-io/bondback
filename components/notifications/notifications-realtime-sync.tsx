"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { notificationQueryKeys } from "@/lib/notifications/query-keys";

/**
 * Keeps React Query notification cache fresh when rows change via Realtime (insert / update).
 */
export function NotificationsRealtimeSync({ userId }: { userId: string | null }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`notifications-rt-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const p = payload as {
            eventType?: string;
            new?: { id?: string; type?: string };
            old?: { id?: string };
          };
          if (process.env.NODE_ENV === "development") {
            console.info("[notifications:realtime]", p.eventType, {
              id: p.new?.id ?? p.old?.id,
              type: p.new?.type,
            });
          }
          void queryClient.invalidateQueries({
            queryKey: notificationQueryKeys.user(userId),
            refetchType: "all",
          });
          void queryClient.invalidateQueries({
            queryKey: notificationQueryKeys.unreadPrefix(userId),
            refetchType: "all",
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return null;
}
