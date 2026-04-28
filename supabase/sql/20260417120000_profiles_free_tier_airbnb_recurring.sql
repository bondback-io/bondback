-- Ongoing free tier: per-lister calendar-month counter for Airbnb + recurring 0% jobs (separate from launch promo slots).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_tier_airbnb_recurring_month_key text NULL,
  ADD COLUMN IF NOT EXISTS free_tier_airbnb_recurring_jobs_used smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.free_tier_airbnb_recurring_month_key IS
  'Australia/Sydney calendar month (YYYY-MM) for which free_tier_airbnb_recurring_jobs_used applies; NULL or mismatch = treat used count as 0 until first bump.';
COMMENT ON COLUMN public.profiles.free_tier_airbnb_recurring_jobs_used IS
  'Completed jobs this calendar month (Sydney) where lister paid 0% via ongoing Airbnb/recurring free tier (not launch promo).';

-- Align default launch slot count with product (first 5 completed jobs at 0%).
ALTER TABLE public.global_settings
  ALTER COLUMN launch_promo_free_job_slots SET DEFAULT 5;

UPDATE public.global_settings
SET launch_promo_free_job_slots = 5
WHERE launch_promo_free_job_slots = 2;
