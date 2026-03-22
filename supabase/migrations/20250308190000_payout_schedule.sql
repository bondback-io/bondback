-- Default payout schedule for the platform (used when cleaner chooses "Follow Platform Default").
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS payout_schedule text NOT NULL DEFAULT 'weekly'
  CHECK (payout_schedule IN ('daily', 'weekly', 'monthly'));

COMMENT ON COLUMN public.global_settings.payout_schedule IS 'Default Stripe Connect payout schedule: daily, weekly, or monthly.';

-- Cleaner preference: platform_default = use global_settings.payout_schedule.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_payout_schedule text NOT NULL DEFAULT 'platform_default'
  CHECK (preferred_payout_schedule IN ('daily', 'weekly', 'monthly', 'platform_default'));

COMMENT ON COLUMN public.profiles.preferred_payout_schedule IS 'Cleaner payout schedule: daily, weekly, monthly, or platform_default to use global default.';
