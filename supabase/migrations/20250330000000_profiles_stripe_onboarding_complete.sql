-- Track whether Stripe Connect Express onboarding has been completed (bank details added).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.stripe_onboarding_complete IS 'True after cleaner completed Stripe Connect onboarding (bank account added). Set on return from Stripe onboarding.';
