-- Email notification preference and notification type support.
-- Run in Supabase SQL editor after ADMIN_BAN_COLUMNS_MIGRATION (if used).
--
-- Required env vars for email (see .env.example):
--   RESEND_API_KEY     - From resend.com dashboard (create free account)
--   RESEND_FROM        - Optional; default "Bond Back <noreply@bondback.io>" (verify bondback.io in Resend)
--   NEXT_PUBLIC_APP_URL - Optional; default https://www.bondback.io (for job links)
--   SUPABASE_SERVICE_ROLE_KEY - Required to resolve user email for sending

-- 1. Add email_notifications to profiles (default true)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.email_notifications IS 'If true, user receives notification emails (in addition to in-app).';

-- 2. If notifications.type is an enum, add new values (adjust name if different):
-- ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'job_created';
-- ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'dispute_resolved';
-- If type is just text, no change needed.
