-- Break infinite recursion (PostgreSQL 42P17) between public.jobs and public.listings RLS.
--
-- Cause: jobs policies used EXISTS (SELECT ... FROM public.listings l ...), which applied
-- listings RLS including "listings_select_when_job_party", which used EXISTS (SELECT ... FROM
-- public.jobs j ...), re-entering jobs policies → infinite recursion.
--
-- Fix: SECURITY DEFINER helper functions owned by a role that bypasses RLS on the inner scan
-- (table owner in Supabase), so policies only call stable functions — no cross-table policy
-- re-entry.
--
-- Apply: Supabase SQL Editor, or `supabase db push` if copied under supabase/migrations/.

CREATE OR REPLACE FUNCTION public.listing_is_marketplace_browseable(p_listing_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inner scans must not re-enter listings RLS (would recurse into jobs policies).
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

COMMENT ON FUNCTION public.listing_is_marketplace_browseable(text) IS
  'RLS helper: true if listing row is marketplace-browseable (same predicate as listings_select_marketplace_*). Used by jobs SELECT policies to avoid jobs↔listings recursion.';

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

COMMENT ON FUNCTION public.listing_has_job_party_for_user(text, uuid) IS
  'RLS helper: true if a jobs row exists for the listing and the user is lister or winner. Used by listings_select_when_job_party to avoid jobs↔listings recursion.';

REVOKE ALL ON FUNCTION public.listing_is_marketplace_browseable(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listing_has_job_party_for_user(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.listing_is_marketplace_browseable(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.listing_has_job_party_for_user(text, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Jobs: marketplace mirror (was: EXISTS subquery on listings)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Listings: party access via job (was: EXISTS subquery on jobs)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "listings_select_when_job_party" ON public.listings;
CREATE POLICY "listings_select_when_job_party"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = lister_id::text
    OR public.listing_has_job_party_for_user(listings.id::text, auth.uid())
  );
