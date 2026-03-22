-- Stripe refund integration: add payment_intent_id, refund_amount, refund_status to jobs.
-- Run in Supabase SQL editor. Ensure jobs.status allows: refunded, partially_refunded.
--
-- Flow:
-- 1. Job has payment_intent_id set when payment is captured (e.g. from checkout.session.completed).
-- 2. Admin confirms refund → Stripe refund created → refund_amount, refund_status updated.
-- 3. Webhook refund.created/refund.updated → sync refund_status to job.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS payment_intent_id text NULL,
  ADD COLUMN IF NOT EXISTS refund_amount integer NULL,
  ADD COLUMN IF NOT EXISTS refund_status text NULL;

-- refund_status: null | 'pending' | 'succeeded' | 'failed'
-- status: add refunded, partially_refunded if your CHECK allows
-- ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
-- ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (status IN ('accepted','in_progress','completed','disputed','dispute_negotiating','in_review','cancelled','refunded','partially_refunded'));

COMMENT ON COLUMN public.jobs.payment_intent_id IS 'Stripe PaymentIntent id for this job (from checkout or manual capture).';
COMMENT ON COLUMN public.jobs.refund_amount IS 'Refund amount in cents actually refunded via Stripe.';
COMMENT ON COLUMN public.jobs.refund_status IS 'Stripe refund status: pending, succeeded, failed.';
