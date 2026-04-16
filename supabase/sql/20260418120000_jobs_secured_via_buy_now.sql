-- Track jobs created when a cleaner uses Buy Now (no accepted bid row).
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS secured_via_buy_now boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jobs.secured_via_buy_now IS
  'True when the job was created via Buy Now (secureJobAtPrice), not lister accepting an auction bid.';

-- Backfill legacy rows: no accepted bid + agreed amount matches listing buy-now price.
UPDATE public.jobs j
SET secured_via_buy_now = true
FROM public.listings l
WHERE j.listing_id = l.id
  AND COALESCE(l.buy_now_cents, 0) > 0
  AND j.agreed_amount_cents = l.buy_now_cents
  AND NOT EXISTS (
    SELECT 1
    FROM public.bids b
    WHERE b.listing_id = l.id
      AND b.status = 'accepted'
  );
