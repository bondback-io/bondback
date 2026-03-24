"use client";

import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { notificationQueryKeys } from "@/lib/notifications/query-keys";
import {
  mergeNotificationPages,
  readNotificationsCache,
  writeNotificationsCache,
  type NotificationRow,
} from "@/lib/notifications/persistence";

export const NOTIFICATIONS_PAGE_SIZE = 25;

type Page = { rows: NotificationRow[]; nextOffset: number | null };

function resegment(rows: NotificationRow[]): InfiniteData<Page> {
  const pages: Page[] = [];
  for (let i = 0; i < rows.length; i += NOTIFICATIONS_PAGE_SIZE) {
    const chunk = rows.slice(i, i + NOTIFICATIONS_PAGE_SIZE);
    pages.push({
      rows: chunk,
      nextOffset:
        chunk.length === NOTIFICATIONS_PAGE_SIZE ? i + NOTIFICATIONS_PAGE_SIZE : null,
    });
  }
  if (pages.length === 0) {
    return { pageParams: [0], pages: [{ rows: [], nextOffset: null }] };
  }
  return {
    pageParams: pages.map((_, i) => i * NOTIFICATIONS_PAGE_SIZE),
    pages,
  };
}

async function fetchPage(userId: string, offset: number): Promise<Page> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + NOTIFICATIONS_PAGE_SIZE - 1);

  if (error) {
    throw new Error(error.message);
  }
  const rows = (data ?? []) as NotificationRow[];
  const hasFull = rows.length === NOTIFICATIONS_PAGE_SIZE;
  return {
    rows,
    nextOffset: hasFull ? offset + NOTIFICATIONS_PAGE_SIZE : null,
  };
}

export function useNotificationsInfinite(
  userId: string | null,
  initialRows?: NotificationRow[] | null
) {
  const queryClient = useQueryClient();

  const initialInfinite: InfiniteData<Page> | undefined =
    initialRows && initialRows.length > 0
      ? resegment(initialRows)
      : undefined;

  const query = useInfiniteQuery({
    queryKey: userId ? notificationQueryKeys.user(userId) : ["notifications", "disabled"],
    enabled: !!userId,
    initialPageParam: 0,
    staleTime: 20_000,
    gcTime: 1000 * 60 * 60 * 24,
    initialData: initialInfinite,
    queryFn: async ({ pageParam }): Promise<Page> => {
      if (!userId) throw new Error("No user");
      return fetchPage(userId, pageParam as number);
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const cached = await readNotificationsCache(userId);
      if (cancelled || !cached?.items.length) return;
      queryClient.setQueryData<InfiniteData<Page>>(
        notificationQueryKeys.user(userId),
        (prev) => {
          if (prev?.pages?.length) return prev;
          return resegment(cached.items);
        }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, queryClient]);

  useEffect(() => {
    if (!userId || !query.data?.pages?.length) return;
    const all = query.data.pages.flatMap((p) => p.rows);
    const last = query.data.pages[query.data.pages.length - 1];
    void writeNotificationsCache(userId, {
      items: all,
      nextOffset: last?.nextOffset ?? null,
      hasMore: last?.nextOffset != null,
    });
  }, [userId, query.data?.pages]);

  const flat = useMemo(
    () =>
      query.data?.pages.flatMap((p) => p.rows) ?? ([] as NotificationRow[]),
    [query.data?.pages]
  );

  const mergeIntoCache = useCallback(
    (updater: (rows: NotificationRow[]) => NotificationRow[]) => {
      if (!userId) return;
      queryClient.setQueryData<InfiniteData<Page>>(
        notificationQueryKeys.user(userId),
        (prev) => {
          const base = prev?.pages?.length
            ? prev.pages.flatMap((p) => p.rows)
            : [];
          return resegment(updater(base));
        }
      );
    },
    [queryClient, userId]
  );

  const optimisticMarkRead = useCallback(
    (id: string) => {
      mergeIntoCache((rows) =>
        rows.map((r) => (r.id === id ? { ...r, is_read: true } : r))
      );
    },
    [mergeIntoCache]
  );

  const optimisticMarkAllRead = useCallback(() => {
    mergeIntoCache((rows) => rows.map((r) => ({ ...r, is_read: true })));
  }, [mergeIntoCache]);

  const prependRow = useCallback(
    (row: NotificationRow) => {
      if (!userId) return;
      queryClient.setQueryData<InfiniteData<Page>>(
        notificationQueryKeys.user(userId),
        (prev) => {
          const base = prev?.pages?.length
            ? prev.pages.flatMap((p) => p.rows)
            : [];
          return resegment(mergeNotificationPages(base, [row]));
        }
      );
    },
    [queryClient, userId]
  );

  const updateRowInCache = useCallback(
    (row: NotificationRow) => {
      mergeIntoCache((rows) => {
        const idx = rows.findIndex((r) => r.id === row.id);
        if (idx === -1) return mergeNotificationPages(rows, [row]);
        const next = [...rows];
        next[idx] = row;
        return next;
      });
    },
    [mergeIntoCache]
  );

  return {
    ...query,
    flat,
    optimisticMarkRead,
    optimisticMarkAllRead,
    prependRow,
    updateRowInCache,
  };
}
