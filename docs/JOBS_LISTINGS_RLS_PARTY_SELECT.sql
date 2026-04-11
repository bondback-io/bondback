-- Allow listers and assigned cleaners to read job + listing rows via the user (anon) client.
-- Without these policies, `/jobs/[numericId]` often returns 404 unless SUPABASE_SERVICE_ROLE_KEY bypasses RLS on the server.
--
-- **Also run** `supabase/migrations/20260430120000_listings_select_marketplace.sql` (or paste below).
-- Party-only listing SELECT blocks **Find Jobs** and **listing detail** for cleaners browsing
-- other users' live listings — marketplace policies allow `live`/`ended`/`expired` rows (not cancelled early).
--
-- Apply in Supabase SQL Editor (Dashboard → SQL) or via `supabase db push` if you add this under supabase/migrations/.
-- Review existing policies first: SELECT * FROM pg_policies WHERE tablename IN ('jobs','listings');
--
-- NOTE: `public.jobs` uses `winner_id` for the assigned cleaner (there is no `cleaner_id` column).
--
-- Compare `auth.uid()` to id columns using `::text` on both sides. Some projects store these as
-- `text`; `auth.uid()` is `uuid` — without casts Postgres errors: operator does not exist: text = uuid.

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
  USING (
    auth.uid()::text = lister_id::text
    OR (winner_id IS NOT NULL AND auth.uid()::text = winner_id::text)
  );

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

-- -----------------------------------------------------------------------------
-- Marketplace browse (required for Find Jobs + `/listings/[uuid]` for other users' listings)
-- Duplicated in: supabase/migrations/20260430120000_listings_select_marketplace.sql
-- -----------------------------------------------------------------------------
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
