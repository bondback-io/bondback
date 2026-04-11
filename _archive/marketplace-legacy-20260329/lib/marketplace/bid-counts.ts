import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/** PostgREST `.in()` safety — avoid oversized filter lists on huge dashboards. */
const LISTING_IDS_CHUNK = 120;

type PublicClient = SupabaseClient<Database, "public", any>;

/**
 * Accurate bid counts per listing for marketplace cards (Find Jobs, dashboards, admin).
 * Single implementation replaces duplicated `bids` scans across pages.
 */
export async function fetchBidCountsByListingIds(
  supabase: PublicClient,
  listingIds: Array<string | number | null | undefined>
): Promise<Record<string, number>> {
  const ids = [
    ...new Set(
      listingIds
        .filter((id): id is string | number => id != null && String(id).trim() !== "")
        .map((id) => String(id))
    ),
  ];
  if (ids.length === 0) return {};

  const out: Record<string, number> = {};

  for (let i = 0; i < ids.length; i += LISTING_IDS_CHUNK) {
    const chunk = ids.slice(i, i + LISTING_IDS_CHUNK);
    const { data: bidsData } = await supabase
      .from("bids")
      .select("listing_id")
      .in("listing_id", chunk);

    (bidsData ?? []).forEach((row: { listing_id: string | number }) => {
      const id = String(row.listing_id);
      out[id] = (out[id] ?? 0) + 1;
    });
  }

  return out;
}
