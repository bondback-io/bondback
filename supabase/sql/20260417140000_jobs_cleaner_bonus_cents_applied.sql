-- Record cleaner promo bonus actually funded on escrow release (extra cents via reduced platform fee).
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS cleaner_bonus_cents_applied integer;

COMMENT ON COLUMN public.jobs.cleaner_bonus_cents_applied IS
  'Extra cents paid to the cleaner on release via cleaner bonus promo (platform fee reduced). Null when none applied.';
