/**
 * IndexedDB cache for notification rows — instant paint on app open, offline resilience.
 * Uses the `idb` package (already in the project).
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Database } from "@/types/supabase";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

const DB_NAME = "bondback-notifications";
const DB_VERSION = 1;
const STORE = "notification-cache";

type CacheEntry = {
  userId: string;
  /** Newest-first merged list (deduped by id). */
  items: NotificationRow[];
  /** Cursor for Supabase pagination: offset of next page (0-based). */
  nextOffset: number | null;
  /** True when server returned fewer than page size. */
  hasMore: boolean;
  updatedAt: number;
};

interface BBNotificationsSchema extends DBSchema {
  [STORE]: {
    key: string;
    value: CacheEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<BBNotificationsSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<BBNotificationsSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BBNotificationsSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

async function keyForUser(userId: string): Promise<string> {
  return `user:${userId}`;
}

export async function readNotificationsCache(userId: string): Promise<CacheEntry | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await getDb();
    const k = await keyForUser(userId);
    const entry = await db.get(STORE, k);
    return entry ?? null;
  } catch {
    return null;
  }
}

export async function writeNotificationsCache(
  userId: string,
  partial: Pick<CacheEntry, "items"> &
    Partial<Pick<CacheEntry, "nextOffset" | "hasMore">>
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await getDb();
    const k = await keyForUser(userId);
    const entry: CacheEntry = {
      userId,
      items: partial.items,
      nextOffset: partial.nextOffset ?? null,
      hasMore: partial.hasMore ?? false,
      updatedAt: Date.now(),
    };
    await db.put(STORE, entry, k);
  } catch {
    // ignore quota / private mode
  }
}

/** Merge server page with existing items, dedupe by id, sort newest first. */
export function mergeNotificationPages(
  existing: NotificationRow[],
  page: NotificationRow[]
): NotificationRow[] {
  const map = new Map<string, NotificationRow>();
  for (const n of [...existing, ...page]) {
    map.set(n.id, n);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function clearNotificationsCache(userId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await getDb();
    await db.delete(STORE, await keyForUser(userId));
  } catch {
    // ignore
  }
}
