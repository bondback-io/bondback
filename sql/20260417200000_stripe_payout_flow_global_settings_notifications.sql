-- Stripe payout gating + notification types for post-win Connect reminders.
-- Apply in Supabase SQL editor if your DB still uses a CHECK on notifications.type.

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS require_stripe_connect_before_payment_release boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.global_settings.require_stripe_connect_before_payment_release IS
  'When true, escrow release (manual or auto) requires the winning cleaner to have completed Stripe Connect.';

-- New default: cleaners may bid / secure buy-now without Connect; admins can re-enable the old rule.
ALTER TABLE public.global_settings
  ALTER COLUMN require_stripe_connect_before_bidding SET DEFAULT false;

UPDATE public.global_settings
SET require_stripe_connect_before_bidding = false
WHERE id = 1 AND require_stripe_connect_before_bidding IS DISTINCT FROM false;

-- Extend notifications.type CHECK if present (inspect with pg_constraint first).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'job_accepted',
  'new_message',
  'job_completed',
  'payment_released',
  'funds_ready',
  'dispute_opened',
  'dispute_resolved',
  'job_created',
  'job_approved_to_start',
  'new_bid',
  'job_cancelled_by_lister',
  'listing_cancelled_by_lister',
  'referral_reward',
  'listing_live',
  'after_photos_uploaded',
  'auto_release_warning',
  'checklist_all_complete',
  'new_job_in_area',
  'job_status_update',
  'early_accept_declined',
  'listing_public_comment',
  'daily_digest',
  'job_won_complete_payout',
  'lister_payout_blocked_cleaner_stripe'
));
