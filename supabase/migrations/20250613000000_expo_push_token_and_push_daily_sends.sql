-- Expo push: store token on profile; rate limit push per user per day (max 5).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expo_push_token text;

COMMENT ON COLUMN public.profiles.expo_push_token IS 'Expo push token for mobile app; set when user enables push in Bond Back app';

CREATE TABLE IF NOT EXISTS push_daily_sends (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_utc date NOT NULL DEFAULT (current_timestamp AT TIME ZONE 'UTC')::date,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date_utc)
);

COMMENT ON TABLE push_daily_sends IS 'Daily push notification count per user for rate limiting (max 5 per day)';
