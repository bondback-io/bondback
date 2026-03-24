/**
 * Serialize + retry IndexedDB opens. `idb` v8+ uses navigator.locks with { steal: true };
 * concurrent opens (e.g. page + service worker on bondback_* DBs) can throw AbortError:
 * "Lock broken by another request with the 'steal' option."
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortOrStealLockError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("steal") || msg.includes("Lock broken");
}

/**
 * Opens IndexedDB with short retries when another context (tab / service worker)
 * steals the Web Lock during open.
 */
export async function openDBWithRetry<DBTypes extends DBSchema | unknown>(
  name: string,
  version: number,
  upgradeCallback?: Parameters<typeof openDB<DBTypes>>[2]
): Promise<IDBPDatabase<DBTypes>> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await openDB<DBTypes>(name, version, upgradeCallback);
    } catch (e) {
      last = e;
      if (!isAbortOrStealLockError(e) || attempt === 2) throw e;
      await sleep(60 * (attempt + 1));
    }
  }
  throw last;
}
