-- After a non-cancelled job has winner_id set, hide the listing from public marketplace SELECT
-- and drop broad job reads for all bidders. Open auctions still use listing_is_marketplace_browseable
-- (no assigned winner yet). Requires SECURITY DEFINER helpers so jobs<>listings RLS does not recurse.
--
-- Apply: supabase db push, or Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.listing_has_non_cancelled_assigned_winner(p_listing_id text)
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
      AND j.status IS DISTINCT FROM 'cancelled'
      AND j.winner_id IS NOT NULL
  );
END;
$$;

COMMENT ON FUNCTION public.listing_has_non_cancelled_assigned_winner(text) IS
  'RLS helper: true if the listing has a non-cancelled job with an assigned cleaner (winner_id). Used to hide won listings from public marketplace policies.';

REVOKE ALL ON FUNCTION public.listing_has_non_cancelled_assigned_winner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listing_has_non_cancelled_assigned_winner(text) TO authenticated, anon;

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

REVOKE ALL ON FUNCTION public.listing_has_job_party_for_user(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listing_has_job_party_for_user(text, uuid) TO authenticated;

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
  )
  AND NOT public.listing_has_non_cancelled_assigned_winner(p_listing_id);
END;
$$;

COMMENT ON FUNCTION public.listing_is_marketplace_browseable(text) IS
  'RLS helper: marketplace-browseable listing without an assigned winner job. Used by jobs SELECT mirror policies.';

REVOKE ALL ON FUNCTION public.listing_is_marketplace_browseable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listing_is_marketplace_browseable(text) TO authenticated, anon;

DROP POLICY IF EXISTS "listings_select_marketplace_authenticated" ON public.listings;
CREATE POLICY "listings_select_marketplace_authenticated"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (
    status IN ('live', 'ended', 'expired')
    AND cancelled_early_at IS NULL
    AND NOT public.listing_has_non_cancelled_assigned_winner(listings.id::text)
  );

DROP POLICY IF EXISTS "listings_select_marketplace_anon" ON public.listings;
CREATE POLICY "listings_select_marketplace_anon"
  ON public.listings
  FOR SELECT
  TO anon
  USING (
    status IN ('live', 'ended', 'expired')
    AND cancelled_early_at IS NULL
    AND NOT public.listing_has_non_cancelled_assigned_winner(listings.id::text)
  );

DROP POLICY IF EXISTS "listings_select_when_job_party" ON public.listings;
CREATE POLICY "listings_select_when_job_party"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = lister_id::text
    OR public.listing_has_job_party_for_user(listings.id::text, auth.uid())
  );

DROP POLICY IF EXISTS "jobs_select_if_bidder" ON public.jobs;
