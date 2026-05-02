-- Cleaner Bonus Promo: platform-funded extra payout to cleaners on early completions (configurable).
-- Apply in Supabase SQL editor (or via migrations pipeline).

-- Global toggles / caps (single row id = 1)
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS enable_cleaner_promo boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS cleaner_promo_max_jobs integer NOT NULL DEFAULT 3;

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS cleaner_promo_duration_days integer NOT NULL DEFAULT 90;

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS cleaner_promo_bonus_percentage numeric(5, 2) NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.global_settings.enable_cleaner_promo IS 'Master switch: cleaner bonus promo on payout.';
COMMENT ON COLUMN public.global_settings.cleaner_promo_max_jobs IS 'Max completed releases per cleaner that can earn the bonus.';
COMMENT ON COLUMN public.global_settings.cleaner_promo_duration_days IS 'Days from first qualifying bonus completion during which promo applies.';
COMMENT ON COLUMN public.global_settings.cleaner_promo_bonus_percentage IS 'Percent of agreed job amount paid as extra cleaner payout, funded by reducing platform fee (capped by fee collected).';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cleaner_promo_jobs_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cleaner_promo_start_date timestamptz;

COMMENT ON COLUMN public.profiles.cleaner_promo_jobs_used IS 'Cleaner bonus promo completions counted toward cleaner_promo_max_jobs.';
COMMENT ON COLUMN public.profiles.cleaner_promo_start_date IS 'Start of cleaner promo window (set when first bonus is applied).';

-- notifications.type CHECK — include types used by the app + cleaner_bonus_earned
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
  'lister_payout_blocked_cleaner_stripe',
  'bid_outbid',
  'listing_assigned_buy_now',
  'listing_expired_no_bids',
  'recurring_next_visit',
  'recurring_contract',
  'recurring_occurrence_skipped',
  'launch_promo_active',
  'launch_promo_progress',
  'launch_promo_ended',
  'cleaner_bonus_earned'
));
