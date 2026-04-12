-- Mirror public.listings marketplace visibility onto public.jobs SELECT.
-- Without this, cleaners browsing live auctions often cannot SELECT the job row (only parties +
-- bidders could), while the app loader uses the service role to read jobs for marketplace listings.
-- After aligning the route with `loadJobByNumericIdForSession`, authenticated/anon users still need
-- RLS that allows SELECT on jobs when the linked listing is marketplace-visible.
--
-- Apply in Supabase SQL Editor or: supabase db push (if synced to migrations).

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_select_if_listing_marketplace_authenticated" ON public.jobs;
CREATE POLICY "jobs_select_if_listing_marketplace_authenticated"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id::text = jobs.listing_id::text
        AND l.status IN ('live', 'ended', 'expired')
        AND l.cancelled_early_at IS NULL
    )
  );

DROP POLICY IF EXISTS "jobs_select_if_listing_marketplace_anon" ON public.jobs;
CREATE POLICY "jobs_select_if_listing_marketplace_anon"
  ON public.jobs
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id::text = jobs.listing_id::text
        AND l.status IN ('live', 'ended', 'expired')
        AND l.cancelled_early_at IS NULL
    )
  );
