import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Count completed jobs per cleaner (`jobs.winner_id`, `status = completed`).
 * Used when enriching bid rows for marketplace / job UI.
 */
export async function countCompletedJobsByWinnerIds(
  admin: SupabaseClient<Database>,
  winnerIds: string[]
): Promise<Map<string, number>> {
  const unique = [...new Set(winnerIds.map((id) => String(id).trim()).filter(Boolean))];
  const out = new Map<string, number>();
  for (const id of unique) out.set(id, 0);
  if (unique.length === 0) return out;

  const { data, error } = await admin
    .from("jobs")
    .select("winner_id")
    .in("winner_id", unique)
    .eq("status", "completed");

  if (error || !data?.length) return out;

  for (const row of data) {
    const w = String((row as { winner_id: string | null }).winner_id ?? "");
    if (!w) continue;
    out.set(w, (out.get(w) ?? 0) + 1);
  }
  return out;
}
