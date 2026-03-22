-- Ensure stripe_connect_id and related columns exist (run in Supabase SQL Editor if Connect payouts fail with "column does not exist").
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_id text;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_id ON public.profiles(stripe_connect_id) WHERE stripe_connect_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.stripe_connect_id IS 'Stripe Connect Express account ID (acct_...) for cleaner payouts.';

-- Also ensure onboarding flag exists (needed after Connect return).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.stripe_onboarding_complete IS 'True after cleaner completed Stripe Connect onboarding.';
