-- Payment hold on job acceptance: store agreed amount and Stripe PaymentIntent id.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS agreed_amount_cents integer;

COMMENT ON COLUMN public.jobs.payment_intent_id IS 'Stripe PaymentIntent id (hold then capture on job completion).';
COMMENT ON COLUMN public.jobs.agreed_amount_cents IS 'Agreed job price in cents (accepted bid or buy-now amount).';

CREATE INDEX IF NOT EXISTS idx_jobs_payment_intent_id ON public.jobs(payment_intent_id) WHERE payment_intent_id IS NOT NULL;
