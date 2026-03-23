"use server";

import type { Database } from "@/types/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchTakenListingIds } from "@/lib/jobs-taken-listing-ids";
import { buildLiveListingsQuery, type JobsListFilters } from "@/lib/jobs-query";
import {
  buildListerCardDataByListingId,
  type ListerCardData,
} from "@/lib/lister-card-data";

export type GetJobsPageResult =
  | {
      ok: true;
      listings: unknown[];
      bidCountByListingId: Record<string, number>;
      listerCardDataByListingId: Record<string, ListerCardData>;
    }
  | { ok: false; error: string };

const JOBS_PAGE_SIZE = 20;

/**
 * Fetch a page of live listings for the /jobs list (infinite scroll).
 * Uses same filters as the jobs page. Requires auth.
 */
export async function getJobsPage(
  page: number,
  filters: JobsListFilters
): Promise<GetJobsPageResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const admin = createSupabaseAdminClient();
  const takenIds = await fetchTakenListingIds(supabase, admin);

  const offset = (page - 1) * JOBS_PAGE_SIZE;
  const query = buildLiveListingsQuery(supabase, filters, takenIds);
  const { data: listings, error } = await query.range(offset, offset + JOBS_PAGE_SIZE - 1);

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (listings ?? []) as Array<{ id: string; lister_id: string }>;
  const listingIds = rows.map((r) => r.id);
  let bidCountByListingId: Record<string, number> = {};

  if (listingIds.length > 0) {
    const { data: bidsData } = await supabase
      .from("bids")
      .select("listing_id")
      .in("listing_id", listingIds);
    (bidsData ?? []).forEach((row: { listing_id: string }) => {
      const id = String(row.listing_id);
      bidCountByListingId[id] = (bidCountByListingId[id] ?? 0) + 1;
    });
  }

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
