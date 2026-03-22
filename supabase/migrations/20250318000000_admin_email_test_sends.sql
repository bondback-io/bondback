-- Rate limit admin test email sends (e.g. 10 per hour per admin)
CREATE TABLE IF NOT EXISTS admin_email_test_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_email_test_sends_admin_sent_idx
  ON admin_email_test_sends(admin_id, sent_at DESC);

COMMENT ON TABLE admin_email_test_sends IS 'Rate limit: admin test email sends per hour';
