-- Find Jobs: `listing_ids_with_jobs` must not treat cancelled jobs as "taking" a listing,
-- or live listings that return after cancel stay hidden from browse forever.
-- Apply in Supabase SQL Editor (Git does not apply to remote DB).

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
    AND j.status IS DISTINCT FROM 'cancelled';
$$;

COMMENT ON FUNCTION public.listing_ids_with_jobs() IS
  'Distinct listing ids with a non-cancelled job row. Used by /jobs browse exclusion when service role is not used.';
