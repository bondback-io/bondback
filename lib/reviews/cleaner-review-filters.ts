/**
 * Reviews rows may set `reviewee_type`, `reviewee_role`, or both (legacy / migrations).
 * Filtering only `reviewee_type = …` drops rows where type is null but role is set.
 */
export function revieweeTypeOrRoleFilter(reviewee: "cleaner" | "lister"): string {
  return `reviewee_type.eq.${reviewee},reviewee_role.eq.${reviewee}`;
}

/** PostgREST `.or(...)` value for “this review targets a cleaner”. */
export const REVIEWEE_IS_CLEANER_OR = revieweeTypeOrRoleFilter("cleaner");

/**
 * Some environments may still be missing `reviews.reviewee_role`.
 * Use this to retry queries with `reviewee_type` only.
 */
export function isMissingRevieweeRoleColumnError(error: { message?: string } | null): boolean {
  const msg = String(error?.message ?? "");
  return /column .*reviewee_role.* does not exist|reviewee_role/i.test(msg);
}
