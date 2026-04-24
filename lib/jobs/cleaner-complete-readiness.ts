import { createServerSupabaseClient } from "@/lib/supabase/server";

const MIN_AFTER_PHOTOS = 3;

/** Matches `@supabase/ssr` server client (differs from bare `SupabaseClient<Database>` generics). */
type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * Same rules as job detail "Clean Complete — Request Payment" and lister finalize validation:
 * every checklist item completed, and at least 3 after-photos in storage (excluding thumbs).
 */
export async function getCleanerReadyToRequestPaymentByJobId(
  supabase: ServerSupabaseClient,
  jobIds: number[]
): Promise<Map<number, boolean>> {
  const out = new Map<number, boolean>();
  for (const id of jobIds) {
    out.set(id, false);
  }
  if (jobIds.length === 0) return out;

  const { data: recurringMeta } = await supabase
    .from("jobs")
    .select("id, recurring_occurrence_id")
    .in("id", jobIds as never);
  const recurringJobIds = new Set<number>();
  for (const m of recurringMeta ?? []) {
    const id = Number((m as { id: number; recurring_occurrence_id: string | null }).id);
    const occ = (m as { recurring_occurrence_id: string | null }).recurring_occurrence_id;
    if (Number.isFinite(id) && occ != null && String(occ).trim()) recurringJobIds.add(id);
  }

  const { data: checklistRows, error: checklistError } = await supabase
    .from("job_checklist_items")
    .select("job_id, is_completed")
    .in("job_id", jobIds as never);

  if (checklistError) {
    return out;
  }

  const byJob = new Map<number, { is_completed: boolean }[]>();
  for (const row of checklistRows ?? []) {
    const jid = Number((row as { job_id: number }).job_id);
    if (!Number.isFinite(jid)) continue;
    const list = byJob.get(jid) ?? [];
    list.push(row as { is_completed: boolean });
    byJob.set(jid, list);
  }

  const storageChecks = await Promise.all(
    jobIds.map(async (jobId) => {
      const items = byJob.get(jobId) ?? [];
      if (recurringJobIds.has(jobId)) {
        if (items.length === 0) return [jobId, true] as const;
        const allDone = items.every((i) => i.is_completed === true);
        return [jobId, allDone] as const;
      }
      const allCompleted =
        items.length > 0 && items.every((i) => i.is_completed === true);
      if (!allCompleted) {
        return [jobId, false] as const;
      }
      const { data: files, error } = await supabase.storage
        .from("condition-photos")
        .list(`jobs/${jobId}/after`, { limit: 100 });
      if (error) {
        return [jobId, false] as const;
      }
      const count = (files ?? []).filter(
        (f) => f.name && !f.name.startsWith("thumb_")
      ).length;
      return [jobId, count >= MIN_AFTER_PHOTOS] as const;
    })
  );

  for (const [jobId, ready] of storageChecks) {
    out.set(jobId, ready);
  }
  return out;
}
