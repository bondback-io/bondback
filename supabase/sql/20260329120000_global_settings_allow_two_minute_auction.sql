-- Optional 2-minute auction duration for staging / live payment flow testing (admin toggle).
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS allow_two_minute_auction_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.global_settings.allow_two_minute_auction_test IS
  'When true, new listing flow may offer a 2-minute auction duration (duration_days=0 sentinel).';
