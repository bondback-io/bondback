import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";

export type AdminReviewsSearchParams = {
  q?: string;
  rating?: string;
  reviewee?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
};

export const ADMIN_REVIEWS_PAGE_SIZE = 25;

function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Mutates PostgREST-style query builder (admin client). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyAdminReviewsFilters(qb: any, sp: AdminReviewsSearchParams): any {
  const q = (sp.q ?? "").trim();
  if (q) {
    if (/^\d+$/.test(q)) {
      qb = qb.eq("job_id", Number(q));
    } else if (q.length > 0) {
      qb = qb.ilike("review_text", `%${escapeIlike(q)}%`);
    }
  }

  const rating = (sp.rating ?? "all").trim();
  if (rating !== "all" && /^[1-5]$/.test(rating)) {
    qb = qb.eq("overall_rating", Number(rating));
  }

  const reviewee = (sp.reviewee ?? "all").toLowerCase();
  if (reviewee === "cleaner") {
    qb = qb.or("reviewee_type.eq.cleaner,reviewee_role.eq.cleaner");
  } else if (reviewee === "lister") {
    qb = qb.or("reviewee_type.eq.lister,reviewee_role.eq.lister");
  }

  const status = (sp.status ?? "all").toLowerCase();
  if (status === "hidden") {
    qb = qb.eq("is_hidden", true);
  } else if (status === "flagged") {
    qb = qb.eq("is_flagged", true);
  } else if (status === "pending") {
    qb = qb.eq("is_approved", false);
  } else if (status === "approved") {
    qb = qb.eq("is_approved", true).eq("is_hidden", false).eq("is_flagged", false);
  }

  const fromRaw = (sp.from ?? "").trim();
  if (fromRaw) {
    const d = parseISO(fromRaw);
    if (isValid(d)) {
      qb = qb.gte("created_at", startOfDay(d).toISOString());
    }
  }
  const toRaw = (sp.to ?? "").trim();
  if (toRaw) {
    const d = parseISO(toRaw);
    if (isValid(d)) {
      qb = qb.lte("created_at", endOfDay(d).toISOString());
    }
  }

  return qb;
}

export function parseAdminReviewsPage(sp: AdminReviewsSearchParams): number {
  const p = Number.parseInt(String(sp.page ?? "1"), 10);
  if (!Number.isFinite(p) || p < 1) return 1;
  return Math.min(500, p);
}
