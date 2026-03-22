-- Abuse review: high dispute activity (opened by user) in rolling window; cron updates + admin alerts

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS high_dispute_opens_30d integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_dispute_abuse_alert_at timestamptz;

COMMENT ON COLUMN public.profiles.high_dispute_opens_30d IS 'Cached count of jobs where this user opened a dispute in the last 30 days (updated by cron).';
COMMENT ON COLUMN public.profiles.last_dispute_abuse_alert_at IS 'Last time admins were notified about high dispute activity for this user.';
