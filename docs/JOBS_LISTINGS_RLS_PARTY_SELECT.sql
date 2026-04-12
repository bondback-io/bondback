-- Allow listers and assigned cleaners to read job + listing rows via the user (anon) client.
-- Without these policies, `/jobs/[numericId]` often returns 404 unless SUPABASE_SERVICE_ROLE_KEY bypasses RLS on the server.
--
-- **42P17 infinite recursion on `jobs`:** If policies use EXISTS (SELECT … FROM listings) on `jobs`
-- AND EXISTS (SELECT … FROM jobs) on `listings`, Postgres re-enters policies forever. The helpers +
-- policy replacements below (or `supabase/sql/20260329180000_jobs_listings_rls_break_recursion.sql`)
-- remove that cycle by scanning `listings` / `jobs` / `bids` inside SECURITY DEFINER helpers with
-- row_security disabled for the inner query only.
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

-- RLS helpers (avoid jobs ↔ listings policy recursion). Same as 20260329180000_jobs_listings_rls_break_recursion.sql
CREATE OR REPLACE FUNCTION public.listing_is_marketplace_browseable(p_listing_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);
  RETURN EXISTS (
    SELECT 1
    FROM public.listings l
    WHERE l.id::text = p_listing_id
      AND l.status IN ('live', 'ended', 'expired')
      AND l.cancelled_early_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.listing_has_job_party_for_user(p_listing_id text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);
  RETURN EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.listing_id::text = p_listing_id
      AND (
        j.lister_id::text = p_user_id::text
        OR (j.winner_id IS NOT NULL AND j.winner_id::text = p_user_id::text)
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.job_listing_has_cleaner_bid(p_listing_id text, p_cleaner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);
  RETURN EXISTS (
    SELECT 1
    FROM public.bids b
    WHERE b.listing_id::text = p_listing_id
      AND b.cleaner_id::text = p_cleaner_id::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.listing_is_marketplace_browseable(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listing_has_job_party_for_user(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.job_listing_has_cleaner_bid(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listing_is_marketplace_browseable(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.listing_has_job_party_for_user(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.job_listing_has_cleaner_bid(text, uuid) TO authenticated;

-- Marketplace mirror: allow SELECT on jobs when the linked listing is browseable (same idea as
-- listings_select_marketplace_*). Required so `/jobs/[numericId]` works for cleaners without
-- relying only on SUPABASE_SERVICE_ROLE_KEY.
DROP POLICY IF EXISTS "jobs_select_if_listing_marketplace_authenticated" ON public.jobs;
CREATE POLICY "jobs_select_if_listing_marketplace_authenticated"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (public.listing_is_marketplace_browseable(jobs.listing_id::text));

DROP POLICY IF EXISTS "jobs_select_if_listing_marketplace_anon" ON public.jobs;
CREATE POLICY "jobs_select_if_listing_marketplace_anon"
  ON public.jobs
  FOR SELECT
  TO anon
  USING (public.listing_is_marketplace_browseable(jobs.listing_id::text));

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
  USING (public.job_listing_has_cleaner_bid(jobs.listing_id::text, auth.uid()));

DROP POLICY IF EXISTS "listings_select_when_job_party" ON public.listings;
CREATE POLICY "listings_select_when_job_party"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = lister_id::text
    OR public.listing_has_job_party_for_user(listings.id::text, auth.uid())
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
