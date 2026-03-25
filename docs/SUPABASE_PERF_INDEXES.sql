-- Bond Back — performance indexes (idempotent). Safe to run in Supabase SQL Editor.
-- Also applied via supabase/migrations/20260328140000_perf_indexes_core_queries.sql
-- and 20260328150000_perf_indexes_extended.sql when using the CLI.
--
-- Notes:
-- - `jobs.winner_id` is the assigned cleaner (no `cleaner_id` column on jobs).
-- - `abn_verified` is modeled as a `verification_badges` entry, not a separate column — GIN on `verification_badges` covers it.
-- - Notifications use `is_read` (not `read`).

-- ========== Core (browse, dashboards, bids, messaging) ==========

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

-- ========== Extended (filters, admin, unread counts) ==========

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
