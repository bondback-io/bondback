-- Optional override for max Expo push notifications per user per day (new-job alerts use this table in app).
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS max_push_per_user_per_day integer;

COMMENT ON COLUMN public.global_settings.enable_sms_alerts_new_jobs IS 'When false, disables new-job SMS and Expo push alerts to cleaners. When true, respects per-user prefs (sms_new_job, push_new_job).';
COMMENT ON COLUMN public.global_settings.max_push_per_user_per_day IS 'Optional override for max push per user per day (default 5). NULL = app default.';
