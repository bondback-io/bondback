-- Public marketplace read for listings when RLS is enabled.
DROP POLICY IF EXISTS "listings_select_marketplace_authenticated" ON public.listings;
CREATE POLICY "listings_select_marketplace_authenticated"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (
    status IN ('live', 'ended', 'expired')
    AND cancelled_early_at IS NULL
  );

DROP POLICY IF EXISTS "listings_select_marketplace_anon" ON public.listings;
CREATE POLICY "listings_select_marketplace_anon"
  ON public.listings
  FOR SELECT
  TO anon
  USING (
    status IN ('live', 'ended', 'expired')
    AND cancelled_early_at IS NULL
  );
