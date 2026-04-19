import { sameUuid, trimStr } from "@/lib/utils";

export type DisputeOpenerJobFields = {
  dispute_opened_by?: string | null;
  lister_id: string;
  winner_id: string | null | undefined;
};

function norm(s: string | null | undefined): string {
  return trimStr(String(s ?? ""));
}

/**
 * `jobs.dispute_opened_by` is a UUID (opener's profile id). Legacy rows may use "lister" | "cleaner".
 */
export function disputeOpenedByLister(job: DisputeOpenerJobFields): boolean {
  const o = norm(job.dispute_opened_by);
  if (!o) return false;
  if (o === "lister") return true;
  if (o === "cleaner") return false;
  return sameUuid(o, job.lister_id);
}

export function disputeOpenedByCleaner(job: DisputeOpenerJobFields): boolean {
  const o = norm(job.dispute_opened_by);
  if (!o) return false;
  if (o === "cleaner") return true;
  if (o === "lister") return false;
  const w = norm(job.winner_id);
  if (!w) return false;
  return sameUuid(o, w);
}

export function disputeOpenerRole(
  job: DisputeOpenerJobFields
): "lister" | "cleaner" | null {
  if (disputeOpenedByLister(job)) return "lister";
  if (disputeOpenedByCleaner(job)) return "cleaner";
  return null;
}

/** Profile id of whoever opened the dispute, when known. */
export function resolveDisputeOpenerUserId(
  job: DisputeOpenerJobFields
): string | null {
  const o = norm(job.dispute_opened_by);
  if (!o) return null;
  if (o === "lister") return norm(job.lister_id) || null;
  if (o === "cleaner") return norm(job.winner_id) || null;
  return o || null;
}
