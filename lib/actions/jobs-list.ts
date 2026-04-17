"use server";

import type { Database } from "@/types/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCachedTakenListingIds } from "@/lib/cached-taken-listing-ids";
import { buildLiveListingsQuery, type JobsListFilters } from "@/lib/jobs-query";
import { jobsBrowsePageRange } from "@/lib/supabase/queries";
import {
  buildListerCardDataByListingId,
  type ListerCardData,
} from "@/lib/lister-card-data";
import { bidCountsForListingIds } from "@/lib/marketplace/server-cache";

export type GetJobsPageResult =
  | {
      ok: true;
      listings: unknown[];
      bidCountByListingId: Record<string, number>;
      listerCardDataByListingId: Record<string, ListerCardData>;
    }
  | { ok: false; error: string };

/**
 * Fetch a page of live listings for the jobs / find-jobs list (infinite scroll).
 * Uses same filters as the browse page. Public (no session required).
 */
export async function getJobsPage(
  page: number,
  filters: JobsListFilters
): Promise<GetJobsPageResult> {
  const supabase = await createServerSupabaseClient();

  const takenIds = await getCachedTakenListingIds();

  const { from, to } = jobsBrowsePageRange(page);
  const query = buildLiveListingsQuery(supabase, filters, takenIds);
  const { data: listings, error } = await query.range(from, to);

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (listings ?? []) as Array<{ id: string; lister_id: string }>;
  const listingIds = rows.map((r) => r.id);
  const bidCountByListingId =
    listingIds.length > 0 ? await bidCountsForListingIds(listingIds) : {};

  const listerRows = rows.map((r) => ({
    id: String(r.id),
    lister_id: String(r.lister_id),
  }));
  const listerCardDataByListingId = await buildListerCardDataByListingId(
    supabase,
    listerRows
  );

  return {
    ok: true,
    listings: rows,
    bidCountByListingId,
    listerCardDataByListingId,
  };
}
