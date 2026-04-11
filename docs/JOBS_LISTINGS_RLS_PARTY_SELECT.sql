-- Allow listers and assigned cleaners to read job + listing rows via the user (anon) client.
-- Without these policies, `/jobs/[numericId]` often returns 404 unless SUPABASE_SERVICE_ROLE_KEY bypasses RLS on the server.
--
-- Apply in Supabase SQL Editor (Dashboard → SQL) or via `supabase db push` if you add this under supabase/migrations/.
-- Review existing policies first: SELECT * FROM pg_policies WHERE tablename IN ('jobs','listings');
--
-- NOTE: `public.jobs` uses `winner_id` for the assigned cleaner (there is no `cleaner_id` column).

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Cleaners can view assigned jobs" ON public.jobs;
DROP POLICY IF EXISTS "Listers can view all their jobs" ON public.jobs;
DROP POLICY IF EXISTS "Cleaners can view jobs assigned to them" ON public.jobs;
DROP POLICY IF EXISTS "Users can view jobs they own or are assigned" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_parties" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_if_bidder" ON public.jobs;

CREATE POLICY "jobs_select_parties"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = lister_id OR auth.uid() = winner_id);

CREATE POLICY "jobs_select_if_bidder"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bids b
      WHERE b.listing_id = jobs.listing_id
        AND b.cleaner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "listings_select_when_job_party" ON public.listings;
CREATE POLICY "listings_select_when_job_party"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = lister_id
    OR EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.listing_id = listings.id
        AND (j.lister_id = auth.uid() OR j.winner_id = auth.uid())
    )
  );
