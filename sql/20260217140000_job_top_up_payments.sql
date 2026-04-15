-- Lister escrow top-ups: additional PaymentIntents linked to the same job (separate from initial payment_intent_id).
-- Each successful top-up appends { payment_intent_id, agreed_cents, fee_cents, note, created_at, stripe_transfer_id? }.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS top_up_payments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.jobs.top_up_payments IS
  'JSON array of top-up escrow holds: payment_intent_id, agreed_cents, fee_cents, note, created_at; stripe_transfer_id set on release.';
