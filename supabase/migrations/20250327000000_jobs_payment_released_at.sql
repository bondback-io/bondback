-- When payment was captured and transferred to cleaner (idempotency for release).
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS payment_released_at timestamptz;

COMMENT ON COLUMN public.jobs.payment_released_at IS 'When the PaymentIntent was captured and funds transferred to the cleaner (Stripe Connect).';
