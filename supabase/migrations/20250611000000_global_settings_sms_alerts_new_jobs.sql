-- Global kill switch for new-job SMS alerts; optional max SMS per user per day override.
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS enable_sms_alerts_new_jobs boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS max_sms_per_user_per_day integer;

COMMENT ON COLUMN public.global_settings.enable_sms_alerts_new_jobs IS 'When false, no new-job-near-you SMS alerts are sent (cleaner preference and rate limit still apply when true).';
COMMENT ON COLUMN public.global_settings.max_sms_per_user_per_day IS 'Optional override for max SMS per user per day (default 5). NULL = use app default.';
