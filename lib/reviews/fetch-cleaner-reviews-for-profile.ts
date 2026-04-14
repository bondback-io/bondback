import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  isMissingRevieweeRoleColumnError,
  REVIEWEE_IS_CLEANER_OR,
} from "@/lib/reviews/cleaner-review-filters";

type Reviewer = { full_name: string | null; profile_photo_url: string | null };

export type CleanerProfileReviewRow = {
  id: number;
  job_id: number | null;
  reviewer_id?: string;
  overall_rating: number;
  quality_of_work: number | null;
  reliability: number | null;
  communication: number | null;
  punctuality: number | null;
  cleanliness: number | null;
  review_text: string | null;
  review_photos: string[] | null;
  created_at: string;
  reviewer?: Reviewer | Reviewer[] | null;
};

const REVIEW_CORE_FIELDS =
  "id, job_id, reviewer_id, overall_rating, quality_of_work, reliability, communication, punctuality, cleanliness, review_text, review_photos, created_at";

const REVIEW_SELECT_WITH_REVIEWER = `${REVIEW_CORE_FIELDS}, reviewer:reviewer_id(full_name, profile_photo_url)`;

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
    .select("id, full_name, profile_photo_url")
    .in("id", ids as never);

  const map = new Map((profs ?? []).map((p) => [p.id, p]));

  for (const r of rows) {
    const rid = typeof r.reviewer_id === "string" ? r.reviewer_id : "";
    if (!rid) continue;
    const p = map.get(rid);
    if (!p) continue;
    const existing = r.reviewer;
    const hasName = Array.isArray(existing)
      ? existing[0]?.full_name?.trim()
      : existing?.full_name?.trim();
    if (hasName) continue;
    r.reviewer = { full_name: p.full_name, profile_photo_url: p.profile_photo_url };
  }
}

/**
 * Loads reviews left for a cleaner on the public profile. Uses the same DB client as the page
 * (`admin ?? supabase`). If the nested `reviewer` embed fails or returns nothing useful, falls
 * back to a flat select and merges reviewer display names (service role can read lister names
 * where the anon key cannot).
 */
export async function fetchCleanerReviewsForPublicProfile(
  primary: SupabaseClient<Database>,
  admin: SupabaseClient<Database> | null,
  cleanerId: string
): Promise<CleanerProfileReviewRow[]> {
  const order = { ascending: false as const };

  const queryWithFilter = async (select: string, useRoleOr: boolean) => {
    let q = primary.from("reviews").select(select).eq("reviewee_id", cleanerId);
    q = useRoleOr ? q.or(REVIEWEE_IS_CLEANER_OR) : q.eq("reviewee_type", "cleaner");
    return q.order("created_at", order);
  };

  let res = await queryWithFilter(REVIEW_SELECT_WITH_REVIEWER, true);
  if (isMissingRevieweeRoleColumnError(res.error)) {
    res = await queryWithFilter(REVIEW_SELECT_WITH_REVIEWER, false);
  }

  let rows = (res.data ?? []) as unknown as CleanerProfileReviewRow[];

  if (res.error) {
    let flat = await queryWithFilter(REVIEW_CORE_FIELDS, true);
    if (isMissingRevieweeRoleColumnError(flat.error)) {
      flat = await queryWithFilter(REVIEW_CORE_FIELDS, false);
    }
    if (!flat.error && flat.data) {
      rows = flat.data as unknown as CleanerProfileReviewRow[];
      const profileDb = admin ?? primary;
      await enrichReviewerProfiles(profileDb, rows);
    } else {
      rows = [];
    }
  } else if (rows.length > 0 && admin) {
    const needsNames = rows.some((r) => {
      const rev = r.reviewer;
      const name = Array.isArray(rev) ? rev[0]?.full_name : rev?.full_name;
      return !String(name ?? "").trim();
    });
    if (needsNames) {
      await enrichReviewerProfiles(admin, rows);
    }
  }

  for (const r of rows) {
    const rev = r.reviewer;
    if (Array.isArray(rev)) {
      r.reviewer = rev[0] ?? null;
    }
  }

  return rows;
}
