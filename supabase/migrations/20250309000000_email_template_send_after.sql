-- When to trigger the email: instant or delayed (e.g. 5m, 1h, 1d).
-- Delayed sending requires a worker/cron to be implemented separately.

ALTER TABLE public.email_template_overrides
  ADD COLUMN IF NOT EXISTS send_after text NOT NULL DEFAULT 'instant';

COMMENT ON COLUMN public.email_template_overrides.send_after IS 'When to send: instant, 5m, 15m, 30m, 1h, 2h, 1d, 2d, 3d, 5d, 7d';
