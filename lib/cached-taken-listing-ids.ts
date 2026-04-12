import "server-only";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchTakenListingIds } from "@/lib/jobs-taken-listing-ids";
import { CACHE_TAGS } from "@/lib/cache-tags";

/**
 * Listing ids with an associated job row — shared across users (not session-specific).
 * Only cached when the service-role client is available; otherwise uses the per-request
 * RPC / RLS path (not globally cached) so results stay correct in local dev.
 */
export async function getCachedTakenListingIds(): Promise<(string | number)[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    const supabase = await createServerSupabaseClient();
    return fetchTakenListingIds(supabase, null);
  }

  /** `unstable_cache` cannot call `cookies()`/`createServerSupabaseClient()`. Admin-only path uses service role only. */
  return unstable_cache(
    async () => {
      const a = createSupabaseAdminClient();
      if (!a) return [];
      return fetchTakenListingIds(a, a);
    },
    ["taken-listing-ids-v2-exclude-cancelled"],
    { revalidate: 45, tags: [CACHE_TAGS.takenListingIds, CACHE_TAGS.jobsBrowse] }
  )();
}
