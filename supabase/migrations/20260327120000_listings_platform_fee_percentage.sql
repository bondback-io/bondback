-- Snapshot platform commission at listing creation so admin global % changes only affect new listings.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS platform_fee_percentage numeric(5,2);

-- Freeze existing listings at the current global rate (one-time).
UPDATE public.listings l
SET platform_fee_percentage = COALESCE(
  (SELECT COALESCE(gs.platform_fee_percentage, gs.fee_percentage, 12::numeric)
   FROM public.global_settings gs
   WHERE gs.id = 1),
  12::numeric
)
WHERE l.platform_fee_percentage IS NULL;

ALTER TABLE public.listings
  ALTER COLUMN platform_fee_percentage SET DEFAULT 12;

ALTER TABLE public.listings
  ALTER COLUMN platform_fee_percentage SET NOT NULL;
