-- Mirror of supabase/sql — last run snapshot for notification crons (admin report).
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS notification_cron_run_status jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.global_settings.notification_cron_run_status IS
  'JSON map: new_listing_reminders | daily_browse_jobs_nudge → { last_run_at, ok, error, result }';
