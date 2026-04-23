-- Find Jobs RPC: exclude both legacy `cancelled` and lister escrow `cancelled_by_lister` so freed listings reappear in browse.
-- Apply in Supabase SQL Editor if migrations are not run from Git.

CREATE OR REPLACE FUNCTION public.listing_ids_with_jobs()
RETURNS TABLE (listing_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT j.listing_id::text
  FROM public.jobs j
  WHERE j.listing_id IS NOT NULL
    AND COALESCE(lower(j.status), '') NOT IN ('cancelled', 'cancelled_by_lister');
$$;

COMMENT ON FUNCTION public.listing_ids_with_jobs() IS
  'Distinct listing ids with a job row that still occupies the listing slot (excludes cancelled and cancelled_by_lister).';
