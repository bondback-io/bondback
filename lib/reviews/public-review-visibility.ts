/**
 * Reviews shown on public cleaner profiles and used in rating aggregates.
 * Keep in sync with RLS policy `reviews_select_public_cleaner_reviews` (Supabase SQL).
 */
export const PUBLIC_REVIEW_VISIBLE = {
  is_approved: true,
  is_hidden: false,
} as const;
