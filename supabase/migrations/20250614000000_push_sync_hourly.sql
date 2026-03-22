-- Rate limit for background-sync completion push: max 3 per user per hour.
CREATE TABLE IF NOT EXISTS push_sync_hourly (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hour_utc text NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, hour_utc)
);

COMMENT ON TABLE push_sync_hourly IS 'Hourly sync push count per user (max 3/hour for bid_sync_success and bid_sync_failure)';
