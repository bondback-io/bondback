-- Allow authenticated listers to INSERT, UPDATE, and SELECT their own listings.
-- - INSERT: required for publishing.
-- - SELECT: required so PostgREST can return the new row from INSERT ... RETURNING (otherwise 0 rows).
-- Without INSERT/UPDATE, user-scoped clients fail RLS. Without SELECT-own, RETURNING can be empty.
--
-- Apply in Supabase SQL Editor or supabase db push.

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listings_select_own_lister" ON public.listings;
CREATE POLICY "listings_select_own_lister"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = lister_id::text);

DROP POLICY IF EXISTS "listings_insert_own_lister" ON public.listings;
CREATE POLICY "listings_insert_own_lister"
  ON public.listings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = lister_id::text);

DROP POLICY IF EXISTS "listings_update_own_lister" ON public.listings;
CREATE POLICY "listings_update_own_lister"
  ON public.listings
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = lister_id::text)
  WITH CHECK (auth.uid()::text = lister_id::text);
