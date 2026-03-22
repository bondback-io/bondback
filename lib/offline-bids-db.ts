/**
 * IndexedDB for offline pending bids. Client-only (use from components or SW via native IDB).
 * DB: bondback_offline, store: pending_bids.
 * Each record: { id?, jobId, amount, timestamp, status: 'pending' }
 */

import { openDB } from "idb";

const DB_NAME = "bondback_offline";
const DB_VERSION = 1;
const STORE = "pending_bids";

export type PendingBid = {
  id?: number;
  jobId: string;
  amount: number;
  timestamp: number;
  status: "pending";
};

const PENDING_BIDS_CHANGED = "pending-bids-changed";

/** Notify listeners that pending bids may have changed (e.g. after add or sync). */
export function notifyPendingBidsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PENDING_BIDS_CHANGED));
  }
}

/** Subscribe to pending bids changes (e.g. to refresh count in UI). */
export function onPendingBidsChanged(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PENDING_BIDS_CHANGED, callback);
  return () => window.removeEventListener(PENDING_BIDS_CHANGED, callback);
}

async function getDB() {
  return openDB<{ [STORE]: { key: number; value: PendingBid } }>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    },
  });
}

/** Add a bid to the queue. Call notifyPendingBidsChanged() after if you need UI to update. */
export async function addPendingBid(bid: Omit<PendingBid, "id" | "timestamp" | "status">): Promise<number> {
  const db = await getDB();
  const record: PendingBid = {
    jobId: bid.jobId,
    amount: bid.amount,
    timestamp: Date.now(),
    status: "pending",
  };
  const id = await db.add(STORE, record);
  return id as number;
}

/** Get all pending bids (for sync). */
export async function getPendingBids(): Promise<PendingBid[]> {
  const db = await getDB();
  return db.getAll(STORE);
}

/** Remove a pending bid by id (after successful sync). */
export async function removePendingBid(id: number): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

/** Remove multiple pending bids by id. */
export async function removePendingBids(ids: number[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

/** Count of pending bids. */
export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE);
}

const EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Remove pending bids older than 7 days. Returns number removed. */
export async function expireOldPendingBids(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  const cutoff = Date.now() - EXPIRE_MS;
  const toRemove = all.filter((b) => b.timestamp < cutoff).map((b) => b.id!);
  if (toRemove.length === 0) return 0;
  await removePendingBids(toRemove.filter((id): id is number => id != null));
  return toRemove.length;
}

/** Register Background Sync for pending bids (call when queueing a bid offline). */
export function registerSyncPendingBids(): void {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
  const reg = navigator.serviceWorker.ready;
  reg.then((registration) => {
    const syncReg = registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
    if (syncReg.sync?.register) {
      syncReg.sync.register("sync-pending-bids").catch(() => {});
    }
  }).catch(() => {});
}
