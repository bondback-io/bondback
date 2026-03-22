-- Toggle for Stripe test-mode UX (labels, help text, etc.).
-- Does NOT switch API keys; STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
-- still control whether you're hitting Stripe test or live.
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS stripe_test_mode boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.global_settings.stripe_test_mode IS 'When true, show Stripe test-mode UI (test labels, help text). Real test vs live mode is still controlled by Stripe API keys in env.';

