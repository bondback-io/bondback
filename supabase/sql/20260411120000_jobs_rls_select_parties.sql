-- Jobs: SELECT for listers, assigned cleaners (winner_id), and cleaners who bid on the listing
-- (winner_id is still null during bidding). Service role bypasses RLS — no policy required.
--
-- Apply in Supabase SQL Editor or: supabase db push (if added under migrations).

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Remove legacy / duplicate names (from older drafts or manual edits)
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Cleaners can view assigned jobs" ON public.jobs;
DROP POLICY IF EXISTS "Listers can view all their jobs" ON public.jobs;
DROP POLICY IF EXISTS "Cleaners can view jobs assigned to them" ON public.jobs;
DROP POLICY IF EXISTS "Users can view jobs they own or are assigned" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_parties" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_if_bidder" ON public.jobs;

-- Owner or assigned cleaner (`winner_id` — there is no `cleaner_id` on `public.jobs`)
CREATE POLICY "jobs_select_parties"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = lister_id::text
    OR (winner_id IS NOT NULL AND auth.uid()::text = winner_id::text)
  );

-- Bidding cleaners: can read the job row linked to a listing they have bid on
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
