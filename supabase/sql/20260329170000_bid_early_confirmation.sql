-- Early bid acceptance: cleaner must confirm before job is created & listing closes.
-- Run in Supabase SQL Editor (safe to run multiple times).

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS pending_confirmation_expires_at timestamptz;

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS early_action_token text;

CREATE UNIQUE INDEX IF NOT EXISTS bids_early_action_token_key
  ON public.bids (early_action_token)
  WHERE early_action_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bids_pending_confirmation_expiry
  ON public.bids (pending_confirmation_expires_at)
  WHERE status = 'pending_confirmation';

COMMENT ON COLUMN public.bids.pending_confirmation_expires_at IS
  'When lister requests early accept; cleaner must confirm before this time.';
COMMENT ON COLUMN public.bids.early_action_token IS
  'Opaque token for confirm/decline links in email (no session required).';
