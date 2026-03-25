-- Performance indexes for hot paths: browse listings, job dashboards, bids, profiles, messaging.

CREATE INDEX IF NOT EXISTS idx_listings_status_end_time
  ON public.listings (status, end_time DESC)
  WHERE cancelled_early_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_lister_created ON public.listings (lister_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_postcode ON public.listings (postcode);

CREATE INDEX IF NOT EXISTS idx_jobs_listing_id ON public.jobs (listing_id);
CREATE INDEX IF NOT EXISTS idx_jobs_lister_id ON public.jobs (lister_id);
CREATE INDEX IF NOT EXISTS idx_jobs_winner_id ON public.jobs (winner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON public.jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_completed_at ON public.jobs (completed_at DESC) WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bids_listing_id ON public.bids (listing_id);
CREATE INDEX IF NOT EXISTS idx_bids_cleaner_listing ON public.bids (cleaner_id, listing_id);

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles (is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_profiles_roles_gin ON public.profiles USING GIN (roles);

CREATE INDEX IF NOT EXISTS idx_job_messages_job_created ON public.job_messages (job_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
