-- /jobs exclusion: when the service role is unavailable, RLS on `jobs` hides rows the
-- user is not party to, so `listing_id`s from cancelled jobs were missing from the
-- exclusion list and listings could incorrectly stay visible in Find Jobs.
-- listing_id may be bigint (legacy) or uuid depending on schema; text works for both.
CREATE OR REPLACE FUNCTION public.listing_ids_with_jobs()
RETURNS TABLE (listing_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT j.listing_id::text
  FROM public.jobs j
  WHERE j.listing_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.listing_ids_with_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listing_ids_with_jobs() TO service_role;

COMMENT ON FUNCTION public.listing_ids_with_jobs() IS
  'Distinct listing ids that have at least one job row. Used by /jobs to exclude listings that already have a job (bypasses RLS when service role is not used).';
