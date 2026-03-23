-- Natural auction end: distinguish no-bid expiry vs ended with bids.
-- 'expired' = end_time passed, no bids, no blocking job (non-cancelled).

CREATE OR REPLACE FUNCTION public.apply_listing_auction_outcomes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Expired: no bids when auction closed
  UPDATE public.listings l
  SET status = 'expired'
  WHERE l.status = 'live'
    AND l.cancelled_early_at IS NULL
    AND l.end_time < now()
    AND NOT EXISTS (SELECT 1 FROM public.bids b WHERE b.listing_id = l.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.listing_id = l.id
        AND COALESCE(j.status, '') <> 'cancelled'
    );

  -- Ended with bids (auction closed, had activity)
  UPDATE public.listings l
  SET status = 'ended'
  WHERE l.status = 'live'
    AND l.cancelled_early_at IS NULL
    AND l.end_time < now()
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.listing_id = l.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.listing_id = l.id
        AND COALESCE(j.status, '') <> 'cancelled'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_listing_auction_outcomes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_listing_auction_outcomes() TO service_role;

COMMENT ON FUNCTION public.apply_listing_auction_outcomes() IS
  'Sets listings to expired (no bids) or ended (had bids) when end_time has passed; skips rows tied to an active (non-cancelled) job.';
