-- Winner assignment when an auction ends with bids is handled in application code
-- (`resolveExpiredLiveAuctions`). This RPC only marks no-bid auctions as `expired`
-- when the service role is unavailable (fallback).

CREATE OR REPLACE FUNCTION public.apply_listing_auction_outcomes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
END;
$$;

COMMENT ON FUNCTION public.apply_listing_auction_outcomes() IS
  'Fallback: sets no-bid expired listings only. With-bids resolution runs in the app (admin client).';
