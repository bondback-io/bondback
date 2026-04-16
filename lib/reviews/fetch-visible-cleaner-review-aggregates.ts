import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  isMissingRevieweeRoleColumnError,
  REVIEWEE_IS_CLEANER_OR,
} from "@/lib/reviews/cleaner-review-filters";
import { PUBLIC_REVIEW_VISIBLE } from "@/lib/reviews/public-review-visibility";

export type VisibleCleanerReviewAggregate = {
  count: number;
  /** Null when count is 0 */
  avg: number | null;
};

/**
 * Public marketplace counts: only reviews that are shown on cleaner profiles
 * (cleaner as reviewee, approved, not hidden). Matches `fetchCleanerReviewsForPublicProfile` rules.
 */
export async function fetchVisibleCleanerReviewAggregatesByCleanerIds(
  client: SupabaseClient<Database>,
  cleanerIds: string[]
): Promise<Map<string, VisibleCleanerReviewAggregate>> {
  const result = new Map<string, VisibleCleanerReviewAggregate>();
  const unique = [...new Set(cleanerIds.map((id) => String(id).trim()).filter(Boolean))];
  if (unique.length === 0) return result;

  const CHUNK = 250;
  const buckets = new Map<string, { sum: number; n: number }>();

  const foldRows = (rows: { reviewee_id?: string; overall_rating?: number | null }[] | null) => {
    for (const row of rows ?? []) {
      const id = String(row.reviewee_id ?? "").trim();
      if (!id) continue;
      const v = Number(row.overall_rating);
      if (!Number.isFinite(v)) continue;
      const b = buckets.get(id) ?? { sum: 0, n: 0 };
      b.sum += v;
      b.n += 1;
      buckets.set(id, b);
    }
  };

  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);

    let res = await client
      .from("reviews")
      .select("reviewee_id, overall_rating")
      .in("reviewee_id", slice as never)
      .eq("is_approved", PUBLIC_REVIEW_VISIBLE.is_approved as never)
      .eq("is_hidden", PUBLIC_REVIEW_VISIBLE.is_hidden as never)
      .or(REVIEWEE_IS_CLEANER_OR);

    if (res.error && /is_approved|is_hidden|column/i.test(String(res.error.message))) {
      res = await client
        .from("reviews")
        .select("reviewee_id, overall_rating")
        .in("reviewee_id", slice as never)
        .or(REVIEWEE_IS_CLEANER_OR);
    }

    if (res.error && isMissingRevieweeRoleColumnError(res.error)) {
      res = await client
        .from("reviews")
        .select("reviewee_id, overall_rating")
        .in("reviewee_id", slice as never)
        .eq("is_approved", PUBLIC_REVIEW_VISIBLE.is_approved as never)
        .eq("is_hidden", PUBLIC_REVIEW_VISIBLE.is_hidden as never)
        .eq("reviewee_type", "cleaner" as never);
    }

    if (!res.error && res.data) {
      foldRows(res.data as { reviewee_id?: string; overall_rating?: number | null }[]);
    }
  }

  for (const id of unique) {
    const b = buckets.get(id);
    if (!b || b.n === 0) {
      result.set(id, { count: 0, avg: null });
    } else {
      result.set(id, { count: b.n, avg: b.sum / b.n });
    }
  }

  return result;
}
