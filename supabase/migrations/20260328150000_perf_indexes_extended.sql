-- Extended indexes: bedrooms filter, auto_release pending review, bid timelines, profiles/notifications.

CREATE INDEX IF NOT EXISTS idx_listings_status_bedrooms
  ON public.listings (status, bedrooms)
  WHERE cancelled_early_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_created_at_desc ON public.listings (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_status_auto_release
  ON public.jobs (status, auto_release_at DESC)
  WHERE status = 'completed_pending_approval' AND auto_release_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_listing_status ON public.jobs (listing_id, status);

CREATE INDEX IF NOT EXISTS idx_bids_listing_created ON public.bids (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_cleaner_created ON public.bids (cleaner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_created_at_desc ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_badges_gin ON public.profiles USING GIN (verification_badges);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications (user_id, is_read, created_at DESC);
