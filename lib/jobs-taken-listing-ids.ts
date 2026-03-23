import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Listing ids that already have a job row — these must be excluded from Find Jobs
 * so cleaners do not bid on listings that are assigned or otherwise tied to a job.
 *
 * Prefer the service-role client when available (full `jobs` table). When it is
 * missing (e.g. local dev), call `listing_ids_with_jobs` RPC so RLS cannot hide
 * other users' cancelled jobs (listing can remain `live` until ended elsewhere).
 */
export async function fetchTakenListingIds(
  supabase: SupabaseClient<Database, "public", any>,
  admin: SupabaseClient<Database, "public", any> | null
): Promise<(string | number)[]> {
  if (admin) {
    const { data } = await admin.from("jobs").select("listing_id");
    return ((data ?? []) as { listing_id: string | number }[]).map((j) => j.listing_id);
  }

  const { data: rpcRows, error: rpcError } = await supabase.rpc("listing_ids_with_jobs");
  if (!rpcError && rpcRows && Array.isArray(rpcRows) && rpcRows.length > 0) {
    return (rpcRows as { listing_id: string }[]).map((r) => r.listing_id);
  }

  const { data: jobsData } = await supabase.from("jobs").select("listing_id");
  return ((jobsData ?? []) as { listing_id: string | number }[]).map((j) => j.listing_id);
}
