import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchBidCountsByListingIds } from "./bid-counts";

const SEP = "\u0001";

function normalizeListingIdsKey(ids: readonly string[]): string {
  return [...new Set(ids.map((x) => String(x).trim()).filter(Boolean))].sort().join(SEP);
}

/**
 * Request-scoped memoization for bid counts (React `cache`).
 * Duplicate calls in the same render (e.g. layout + page) hit one PostgREST query.
 */
const getBidCountsCached = cache(async (idsKey: string) => {
  const ids = idsKey ? idsKey.split(SEP) : [];
  if (ids.length === 0) return {};
  const supabase = await createServerSupabaseClient();
  return fetchBidCountsByListingIds(supabase, ids);
});

/**
 * Accurate bid counts for marketplace cards on server components / server actions
 * that use the user session client (not admin service role).
 */
export function bidCountsForListingIds(
  listingIds: Array<string | number | null | undefined>
): Promise<Record<string, number>> {
  const keys = listingIds
    .filter((id): id is string | number => id != null && String(id).trim() !== "")
    .map((id) => String(id));
  return getBidCountsCached(normalizeListingIdsKey(keys));
}
