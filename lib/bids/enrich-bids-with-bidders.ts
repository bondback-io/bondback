import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BidRow } from "@/lib/listings";
import type { BidBidderProfileSummary } from "@/lib/bids/bidder-types";
import { countCompletedJobsByWinnerIds } from "@/lib/bids/completed-job-counts";

export const BIDDER_PROFILE_SUMMARY_SELECT =
  "id, cleaner_username, first_name, last_name, full_name, bio, profile_photo_url, years_experience, suburb, state, postcode, verification_badges, specialties, business_name, cleaner_avg_rating, cleaner_total_reviews";

type BidWithProfile = BidRow & { bidder_profile?: BidBidderProfileSummary | null };

/**
 * Attach `bidder_profile` for each bid’s `cleaner_id` (admin client; safe on server routes only).
 */
export async function enrichBidsWithBidderProfiles(
  bids: BidRow[] | null | undefined
): Promise<BidWithProfile[]> {
  const list = bids ?? [];
  if (list.length === 0) return [];

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return list.map((b) => ({ ...b, bidder_profile: null }));
  }

  const ids = [...new Set(list.map((b) => String(b.cleaner_id)))];
  const { data: profs, error } = await admin
    .from("profiles")
    .select(BIDDER_PROFILE_SUMMARY_SELECT)
    .in("id", ids);

  if (error) {
    console.warn("[enrichBidsWithBidderProfiles]", error.message);
    return list.map((b) => ({ ...b, bidder_profile: null }));
  }

  const map = new Map<string, BidBidderProfileSummary>();
  for (const row of profs ?? []) {
    map.set(String((row as { id: string }).id), row as BidBidderProfileSummary);
  }

  const jobCounts = await countCompletedJobsByWinnerIds(admin, ids);

  return list.map((b) => {
    const cid = String(b.cleaner_id);
    const base = map.get(cid) ?? null;
    const bidder_profile = base
      ? {
          ...base,
          completed_jobs_count: jobCounts.get(cid) ?? 0,
        }
      : null;
    return { ...b, bidder_profile };
  });
}
