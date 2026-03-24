-- Per-recipient rate limit: one job-related notification email per job per hour per user
-- (prevents blocking the second party when both lister and cleaner need an email for the same job).
DROP TABLE IF EXISTS public.notification_email_rate_limit;
CREATE TABLE public.notification_email_rate_limit (
  job_id bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, user_id)
);

COMMENT ON TABLE public.notification_email_rate_limit IS 'Last notification email sent per (job, recipient) for throttling (e.g. new_message).';

ALTER TABLE public.notification_email_rate_limit ENABLE ROW LEVEL SECURITY;

-- email_logs may be missing if 20250308000000 was never applied; create then upgrade.
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  subject text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  recipient_email text
);

CREATE INDEX IF NOT EXISTS email_logs_user_id_idx ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx ON public.email_logs(sent_at DESC);

COMMENT ON TABLE public.email_logs IS 'Log of sent notification emails for admin visibility';

-- Older installs: table existed without audit columns
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS recipient_email text;

COMMENT ON COLUMN public.email_logs.status IS 'sent | failed | skipped';
COMMENT ON COLUMN public.email_logs.recipient_email IS 'Destination address (for support when debugging)';
