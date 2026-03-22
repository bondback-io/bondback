-- Require cleaners to connect Stripe (bank account) before placing bids.
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS require_stripe_connect_before_bidding boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.global_settings.require_stripe_connect_before_bidding IS 'When true, cleaners must connect bank account (Stripe Connect) before bidding.';
