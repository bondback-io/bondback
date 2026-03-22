-- Store Stripe Connect Express account ID for cleaners (payouts).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_id text;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_id ON public.profiles(stripe_connect_id) WHERE stripe_connect_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.stripe_connect_id IS 'Stripe Connect Express account ID (acct_...) for cleaner payouts.';
