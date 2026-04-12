-- Broad SELECT on public.listings for any authenticated user (browse + detail).
-- Apply in Supabase SQL Editor. Complements marketplace policies: with multiple SELECT policies,
-- a row is visible if ANY policy passes (OR).
--
-- Use when cleaners still cannot read listing rows via the user-scoped client (e.g. drafts
-- during testing, or RLS drift). This exposes every listing row to logged-in users, including
-- non-marketplace statuses — review before production.

DROP POLICY IF EXISTS "listings_select_all_authenticated" ON public.listings;
CREATE POLICY "listings_select_all_authenticated"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (true);
