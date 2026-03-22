-- SMS rate limit: max 5 SMS per user per calendar day (UTC).
CREATE TABLE IF NOT EXISTS sms_daily_sends (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_utc date NOT NULL DEFAULT (current_timestamp AT TIME ZONE 'UTC')::date,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date_utc)
);

COMMENT ON TABLE sms_daily_sends IS 'Daily SMS send count per user for rate limiting (max 5 per day)';
