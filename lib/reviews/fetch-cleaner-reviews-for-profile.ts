import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { formatReviewerDisplayName } from "@/lib/reviews/reviewer-display-name";

type Reviewer = {
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_photo_url: string | null;
};

export type CleanerProfileReviewRow = {
  id: number;
  job_id: number | null;
  reviewer_id?: string;
  overall_rating: number;
  quality_of_work: number | null;
  reliability: number | null;
  communication: number | null;
  punctuality: number | null;
  review_text: string | null;
  review_photos: string[] | null;
  created_at: string;
  reviewer?: Reviewer | Reviewer[] | null;
};

const REVIEW_CORE_FIELDS =
  "id, job_id, reviewer_id, overall_rating, quality_of_work, reliability, communication, punctuality, review_text, review_photos, created_at";

const REVIEW_SELECT_WITH_REVIEWER = `${REVIEW_CORE_FIELDS}, reviewer:reviewer_id(full_name, first_name, last_name, profile_photo_url)`;

async function enrichReviewerProfiles(
  db: SupabaseClient<Database>,
  rows: CleanerProfileReviewRow[]
) {
  const ids = [
    ...new Set(
      rows
        .map((r) => (typeof r.reviewer_id === "string" ? r.reviewer_id.trim() : ""))
        .filter(Boolean)
    ),
  ];
  if (ids.length === 0) return;

  const { data: profs } = await db
    .from("profiles")
    .select("id, full_name, first_name, last_name, profile_photo_url")
    .in("id", ids as never);

  const map = new Map((profs ?? []).map((p) => [p.id, p]));

  for (const r of rows) {
    const rid = typeof r.reviewer_id === "string" ? r.reviewer_id : "";
    if (!rid) continue;
    const p = map.get(rid);
    if (!p) continue;
    const existing = r.reviewer;
    const single = Array.isArray(existing) ? existing[0] : existing;
    if (formatReviewerDisplayName(single)) continue;
    const display = formatReviewerDisplayName(p) ?? (p.full_name as string | null);
    r.reviewer = {
      full_name: display,
      first_name: (p as { first_name?: string | null }).first_name ?? null,
      last_name: (p as { last_name?: string | null }).last_name ?? null,
      profile_photo_url: p.profile_photo_url,
    };
  }
}

/**
 * Loads reviews left for a cleaner on the public profile. Uses the same DB client as the page
 * (`admin ?? supabase`). Filter is **reviewee_id only** — older rows may have null `reviewee_type` /
 * `reviewee_role`; an extra `.or(reviewee_type.eq.cleaner,…)` dropped those and hid written feedback
 * while `cleaner_total_reviews` still counted them.
 * If the nested `reviewer` embed fails, falls back to a flat select and merges reviewer names.
 */
export type FetchCleanerReviewsOptions = {
  /** When set, only the N most recent reviews are loaded (e.g. bidder preview). */
  limit?: number;
};

export async function fetchCleanerReviewsForPublicProfile(
  primary: SupabaseClient<Database>,
  admin: SupabaseClient<Database> | null,
  cleanerId: string,
  options?: FetchCleanerReviewsOptions
): Promise<CleanerProfileReviewRow[]> {
  const order = { ascending: false as const };
  const cap =
    options?.limit != null && Number.isFinite(options.limit) && options.limit > 0
      ? Math.min(100, Math.floor(options.limit))
      : null;

  const runQuery = async (select: string) => {
    let q = primary.from("reviews").select(select).eq("reviewee_id", cleanerId);
    q = q.order("created_at", order);
    if (cap != null) {
      q = q.limit(cap);
    }
    return q;
  };

  let res = await runQuery(REVIEW_SELECT_WITH_REVIEWER);
  let rows = (res.data ?? []) as unknown as CleanerProfileReviewRow[];

  if (res.error) {
    const flat = await runQuery(REVIEW_CORE_FIELDS);
    if (!flat.error && flat.data) {
      rows = flat.data as unknown as CleanerProfileReviewRow[];
      await enrichReviewerProfiles(admin ?? primary, rows);
    } else {
      rows = [];
    }
  } else if (rows.length > 0) {
    const needsNames = rows.some((r) => {
      const rev = r.reviewer;
      const one = Array.isArray(rev) ? rev[0] : rev;
      return !formatReviewerDisplayName(one);
    });
    if (needsNames) {
      await enrichReviewerProfiles(admin ?? primary, rows);
    }
  }

  for (const r of rows) {
    let single = r.reviewer;
    if (Array.isArray(single)) {
      single = single[0] ?? null;
      r.reviewer = single;
    }
    if (single) {
      const d = formatReviewerDisplayName(single);
      if (d) single.full_name = d;
    }
  }

  return rows;
}
