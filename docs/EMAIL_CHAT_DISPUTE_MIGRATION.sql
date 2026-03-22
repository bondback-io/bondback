-- Tables for email integration: rate limiting and "recipient not viewing" check.
-- Run in Supabase SQL editor.

-- 1. Rate limit: max 1 notification email per job per hour
CREATE TABLE IF NOT EXISTS public.notification_email_rate_limit (
  job_id bigint PRIMARY KEY,
  last_sent_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_email_rate_limit IS 'Tracks last notification email sent per job for 1-email-per-hour rate limit.';

-- 2. When recipient last viewed the job page (so we can skip email if they are viewing)
CREATE TABLE IF NOT EXISTS public.last_job_view (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id bigint NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

COMMENT ON TABLE public.last_job_view IS 'Updated when user loads job page; used to skip new-message email if recipient is viewing.';

-- RLS: users can only insert/update their own last_job_view row
ALTER TABLE public.last_job_view ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can upsert own last_job_view" ON public.last_job_view;
CREATE POLICY "Users can upsert own last_job_view" ON public.last_job_view
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Rate limit table: only backend (service role) should read/write
ALTER TABLE public.notification_email_rate_limit ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role can access (used in server-side email flow).
