-- Ensure job payment columns exist (fixes "Could not find agreed_amount_cents in schema cache").
-- Run in Supabase SQL Editor if you see schema cache errors for jobs.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS agreed_amount_cents integer,
  ADD COLUMN IF NOT EXISTS payment_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text;

COMMENT ON COLUMN public.jobs.payment_intent_id IS 'Stripe PaymentIntent id (hold then capture on job completion).';
COMMENT ON COLUMN public.jobs.agreed_amount_cents IS 'Agreed job price in cents (accepted bid or buy-now amount).';
COMMENT ON COLUMN public.jobs.payment_released_at IS 'When the PaymentIntent was captured and funds transferred to the cleaner (Stripe Connect).';
COMMENT ON COLUMN public.jobs.stripe_transfer_id IS 'Stripe Connect transfer id (to cleaner); used for partial refund reversals.';

CREATE INDEX IF NOT EXISTS idx_jobs_payment_intent_id ON public.jobs(payment_intent_id) WHERE payment_intent_id IS NOT NULL;
