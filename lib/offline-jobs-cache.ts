/**
 * IndexedDB cache for offline job list and job detail. Shared by client and service worker (SW uses native IDB).
 * DB: bondback_jobs_cache, store: cache.
 * Keys: "list" (jobs list), "job_{id}" (job detail), "last_sync" (timestamp).
 */

import { openDB } from "idb";

const DB_NAME = "bondback_jobs_cache";
const DB_VERSION = 1;
const STORE = "cache";

const LIST_KEY = "list";
const LAST_SYNC_KEY = "last_sync";

function jobKey(id: string): string {
  return `job_${id}`;
}

type CacheEntry<T = unknown> = { data: T; fetchedAt: number };

async function getDB() {
  return openDB<{ [STORE]: { key: string; value: CacheEntry | number } }>(
    DB_NAME,
    DB_VERSION,
    {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    }
  );
}

/** Save jobs list to cache and update last_sync. */
export async function setJobsList(
  listings: unknown[],
  bidCountByListingId: Record<string, number>
): Promise<void> {
  const db = await getDB();
  const now = Date.now();
  await db.put(STORE, { data: { listings, bidCountByListingId }, fetchedAt: now }, LIST_KEY);
  await db.put(STORE, now, LAST_SYNC_KEY);
}

/** Get cached jobs list or null. */
export async function getJobsList(): Promise<{
  listings: unknown[];
  bidCountByListingId: Record<string, number>;
  fetchedAt: number;
} | null> {
  const db = await getDB();
  const entry = await db.get(STORE, LIST_KEY) as CacheEntry<{ listings: unknown[]; bidCountByListingId: Record<string, number> }> | undefined;
  if (!entry || typeof entry !== "object" || !entry.data) return null;
  return {
    ...(entry.data as { listings: unknown[]; bidCountByListingId: Record<string, number> }),
    fetchedAt: entry.fetchedAt,
  };
}

/** Save job detail to cache and update last_sync. */
export async function setJobDetail(id: string, data: unknown): Promise<void> {
  const db = await getDB();
  const now = Date.now();
  await db.put(STORE, { data, fetchedAt: now }, jobKey(id));
  await db.put(STORE, now, LAST_SYNC_KEY);
}

/** Get cached job detail or null. */
export async function getJobDetail(id: string): Promise<{ data: unknown; fetchedAt: number } | null> {
  const db = await getDB();
  const entry = await db.get(STORE, jobKey(id)) as CacheEntry | undefined;
  if (!entry || typeof entry !== "object" || entry.data == null) return null;
  return { data: entry.data, fetchedAt: entry.fetchedAt };
}

/** Get last sync timestamp (ms). */
export async function getLastSync(): Promise<number | null> {
  const db = await getDB();
  const val = await db.get(STORE, LAST_SYNC_KEY);
  if (typeof val === "number" && val > 0) return val;
  return null;
}

export { DB_NAME, STORE, LIST_KEY, LAST_SYNC_KEY, jobKey };
