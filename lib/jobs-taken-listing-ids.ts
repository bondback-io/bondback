import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { JOB_STATUS_NOT_IN_LISTING_SLOT } from "@/lib/jobs/job-status-helpers";

/**
 * Listing ids that already have an **active** job row — excluded from Find Jobs so cleaners
 * do not bid on assigned work. **Cancelled** jobs must NOT count: the listing can be live
 * again, and including cancelled rows would hide those listings from browse forever.
 *
 * Prefer the service-role client when available (full `jobs` table). When it is
 * missing (e.g. local dev), call `listing_ids_with_jobs` RPC so RLS cannot hide
 * other users' jobs (listing can remain `live` until ended elsewhere).
 */
export async function fetchTakenListingIds(
  supabase: SupabaseClient<Database, "public", any>,
  admin: SupabaseClient<Database, "public", any> | null
): Promise<(string | number)[]> {
  if (admin) {
    const { data } = await admin
      .from("jobs")
      .select("listing_id")
      .not("status", "in", JOB_STATUS_NOT_IN_LISTING_SLOT);
    return ((data ?? []) as { listing_id: string | number }[]).map((j) => j.listing_id);
  }

  const { data: rpcRows, error: rpcError } = await supabase.rpc("listing_ids_with_jobs");
  if (!rpcError && rpcRows && Array.isArray(rpcRows) && rpcRows.length > 0) {
    return (rpcRows as { listing_id: string }[]).map((r) => r.listing_id);
  }

  const { data: jobsData } = await supabase
    .from("jobs")
    .select("listing_id")
    .not("status", "in", JOB_STATUS_NOT_IN_LISTING_SLOT);
  return ((jobsData ?? []) as { listing_id: string | number }[]).map((j) => j.listing_id);
}
