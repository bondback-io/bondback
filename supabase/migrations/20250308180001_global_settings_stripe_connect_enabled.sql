-- Global kill switch for Stripe Connect (show Connect UI and allow payouts when true).
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS stripe_connect_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.global_settings.stripe_connect_enabled IS 'When true, Stripe Connect is enabled (cleaners can connect bank, receive payouts). When false, Connect flows are disabled.';
