-- Allow admins to bypass the normal $100 AUD minimum starting price for new listings (e.g. $1 live tests).
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS allow_low_amount_listings boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.global_settings.allow_low_amount_listings IS
  'When true, new listing starting price may be as low as $0.01 AUD (default off: $100 min).';
