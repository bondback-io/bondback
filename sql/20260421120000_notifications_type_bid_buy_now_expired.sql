-- Extend notifications.type CHECK for bidding / auction outcome types.
-- Apply in Supabase SQL editor if your DB uses notifications_type_check.

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
  'listing_expired_no_bids'
));
