-- Store Stripe transfer id on job for refund/reversal flows.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text;

COMMENT ON COLUMN public.jobs.stripe_transfer_id IS 'Stripe Connect transfer id (to cleaner); used for partial refund reversals.';

-- Admin: manual payout mode (when on, auto-release may be disabled or payouts require admin action).
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS manual_payout_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.global_settings.manual_payout_mode IS 'When true, platform uses manual payout flow (e.g. no auto-release or admin-approve payouts).';
