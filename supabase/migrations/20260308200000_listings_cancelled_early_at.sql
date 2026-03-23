-- Track when a lister ends a live auction early (cancel listing). Distinct from natural auction end.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS cancelled_early_at timestamptz;

COMMENT ON COLUMN public.listings.cancelled_early_at IS
  'Set when the lister cancels/ends the listing before the scheduled auction end (no job row required).';
