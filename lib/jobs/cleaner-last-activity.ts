import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Legacy default (5×24h) — non-responsive cancel now uses `global_settings.lister_nonresponsive_cancel_idle_days`. */
const IDLE_MS = 5 * 24 * 60 * 60 * 1000;

export function nonResponsiveCancelIdleMsFromDays(days: number): number {
  const d = Math.max(0, Math.min(7, Math.floor(Number(days) || 0)));
  if (d <= 0) return 0;
  return d * 24 * 60 * 60 * 1000;
}

/**
 * Latest timestamp (ms) of cleaner-attributable activity on the job, or null if none found.
 */
export async function getCleanerLastActivityAtMs(
  jobId: number,
  cleanerId: string | null | undefined
): Promise<number | null> {
  if (!cleanerId?.trim() || !Number.isFinite(jobId) || jobId < 1) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  let maxMs = 0;

  const { data: jobRow } = await admin
    .from("jobs")
    .select("cleaner_confirmed_at")
    .eq("id", jobId)
    .maybeSingle();
  const confirmed = (jobRow as { cleaner_confirmed_at?: string | null } | null)?.cleaner_confirmed_at;
  if (confirmed) {
    maxMs = Math.max(maxMs, new Date(confirmed).getTime());
  }

  const { data: lastMsg } = await admin
    .from("job_messages")
    .select("created_at")
    .eq("job_id", jobId)
    .eq("sender_id", cleanerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const msgAt = (lastMsg as { created_at?: string } | null)?.created_at;
  if (msgAt) maxMs = Math.max(maxMs, new Date(msgAt).getTime());

  const { data: lastDispute } = await (admin as any)
    .from("dispute_messages")
    .select("created_at")
    .eq("job_id", jobId)
    .eq("author_user_id", cleanerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const dmAt = lastDispute?.created_at as string | undefined;
  if (dmAt) maxMs = Math.max(maxMs, new Date(dmAt).getTime());

  const folder = `jobs/${jobId}/after`;
  const { data: files } = await admin.storage.from("condition-photos").list(folder, { limit: 100 });
  for (const f of files ?? []) {
    const raw = f as { updated_at?: string; created_at?: string };
    const u = raw.updated_at || raw.created_at;
    if (u) maxMs = Math.max(maxMs, new Date(u).getTime());
  }

  return maxMs > 0 ? maxMs : null;
}

export function idleLongEnoughForNonResponsiveCancel(
  lastCleanerActivityMs: number | null,
  escrowFundedAtIso: string | null,
  jobCreatedAtIso: string | null,
  requiredIdleMs: number
): { ok: boolean; idleSinceMs: number } {
  const now = Date.now();
  const escrowMs = escrowFundedAtIso?.trim()
    ? new Date(escrowFundedAtIso).getTime()
    : NaN;
  const createdMs = jobCreatedAtIso?.trim() ? new Date(jobCreatedAtIso).getTime() : NaN;
  const baselineMs =
    lastCleanerActivityMs ??
    (Number.isFinite(escrowMs) ? escrowMs : Number.isFinite(createdMs) ? createdMs : now);
  if (!Number.isFinite(requiredIdleMs) || requiredIdleMs <= 0) {
    return { ok: true, idleSinceMs: baselineMs };
  }
  return { ok: now - baselineMs >= requiredIdleMs, idleSinceMs: baselineMs };
}

/** @deprecated Use `nonResponsiveCancelIdleMsFromDays` from global settings. */
export { IDLE_MS as NONRESPONSIVE_CANCEL_IDLE_MS };
