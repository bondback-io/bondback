-- Notification preferences (jsonb) and admin overrides on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_force_disabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_preferences_locked boolean DEFAULT false;

COMMENT ON COLUMN profiles.notification_preferences IS 'User email toggles: new_bid, new_message, job_accepted, job_completed, dispute, payment_released, weekly_tips, receive_all_non_critical';
COMMENT ON COLUMN profiles.email_force_disabled IS 'Admin: force-disable all emails for this user';
COMMENT ON COLUMN profiles.email_preferences_locked IS 'Admin: lock so user cannot change notification_preferences';

-- Stub table for sent email log (admin visibility)
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  subject text
);

CREATE INDEX IF NOT EXISTS email_logs_user_id_idx ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx ON email_logs(sent_at DESC);

COMMENT ON TABLE email_logs IS 'Log of sent notification emails for admin visibility';
