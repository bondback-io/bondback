-- Fix text vs uuid comparisons in RLS (auth.uid() is uuid; some columns may be text).
-- Error without casts: operator does not exist: text = uuid

DROP POLICY IF EXISTS "jobs_select_parties" ON public.jobs;
CREATE POLICY "jobs_select_parties"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = lister_id::text
    OR (winner_id IS NOT NULL AND auth.uid()::text = winner_id::text)
  );

DROP POLICY IF EXISTS "jobs_select_if_bidder" ON public.jobs;
CREATE POLICY "jobs_select_if_bidder"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bids b
      WHERE b.listing_id::text = jobs.listing_id::text
        AND b.cleaner_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "listings_select_when_job_party" ON public.listings;
CREATE POLICY "listings_select_when_job_party"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = lister_id::text
    OR EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.listing_id::text = listings.id::text
        AND (
          j.lister_id::text = auth.uid()::text
          OR (j.winner_id IS NOT NULL AND j.winner_id::text = auth.uid()::text)
        )
    )
  );
