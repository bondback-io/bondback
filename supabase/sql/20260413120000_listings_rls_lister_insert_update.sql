-- Allow authenticated listers to INSERT and UPDATE their own listings.
-- Without these, client-side inserts fail with "new row violates row-level security policy"
-- when only marketplace SELECT policies exist (e.g. after JOBS_LISTINGS_RLS_PARTY_SELECT.sql).
--
-- Apply in Supabase SQL Editor or supabase db push.

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

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
