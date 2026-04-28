-- =============================================================================
-- Bond Back: ensure public.global_settings has every column required for
-- Admin → Global Settings save (lib/actions/global-settings.ts → saveGlobalSettings).
--
-- Safe to run repeatedly (idempotent). Run in Supabase SQL Editor as postgres.
-- If your table was created from an old migration set, missing columns cause
-- PostgREST errors (42703 / "column does not exist") and saves appear to fail.
-- =============================================================================

-- Core table (only creates an empty shell when the table does not exist yet)
CREATE TABLE IF NOT EXISTS public.global_settings (
  id integer NOT NULL,
  CONSTRAINT global_settings_single_row_check CHECK (id = 1)
);

-- ---------------------------------------------------------------------------
-- Columns touched by saveGlobalSettings upsert + common reads
-- ---------------------------------------------------------------------------

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS platform_fee_percentage numeric(5, 2) NOT NULL DEFAULT 12;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS fee_percentage numeric(5, 2) NOT NULL DEFAULT 12;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS platform_fee_percentage_by_service_type jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS require_abn boolean NOT NULL DEFAULT true;
-- Legacy name kept in some DBs; app reads require_abn. Sync if both exist (harmless if only one).
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS abn_required boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS require_stripe_connect_before_bidding boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS require_stripe_connect_before_payment_release boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS min_profile_completion integer NOT NULL DEFAULT 70;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS auto_release_hours integer NOT NULL DEFAULT 48;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS emails_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS announcement_text text;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS announcement_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS maintenance_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS maintenance_message text;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_referrer_amount numeric(10, 2) NOT NULL DEFAULT 20;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_referred_amount numeric(10, 2) NOT NULL DEFAULT 10;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_min_job_amount numeric(10, 2) NOT NULL DEFAULT 100;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_max_per_user_month integer NOT NULL DEFAULT 10;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_terms_text text;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS manual_payout_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS platform_abn text;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS send_payment_receipt_emails boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS stripe_connect_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS payout_schedule text NOT NULL DEFAULT 'weekly';
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS stripe_test_mode boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS floating_chat_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS enable_sms_alerts_new_jobs boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS additional_notification_radius_buffer_km integer NOT NULL DEFAULT 50;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS new_listing_reminder_interval_hours integer NOT NULL DEFAULT 6;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS enable_new_listing_reminders boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS default_cleaner_checklist_items text[] NOT NULL DEFAULT ARRAY[
  'Vacuum Apartment/House',
  'Clean all Bedrooms',
  'Clean all Bathrooms',
  'Clean Toilet',
  'Clean Kitchen',
  'Clean Laundry',
  'Mop Floors (if needed)'
];

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS enable_sms_notifications boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS sms_type_enabled jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS max_sms_per_user_per_day integer;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS max_push_per_user_per_day integer;

-- Pricing (new listing quotes)
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_base_rate_per_bedroom_aud numeric(10, 2) NOT NULL DEFAULT 131;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_base_rate_per_bedroom_by_service_type jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_base_multiplier numeric(8, 4) NOT NULL DEFAULT 1;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_base_multiplier_by_service_type jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_bathroom_rate_per_bathroom_by_service_type jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_condition_excellent_very_good_pct numeric(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_condition_good_pct numeric(5, 2) NOT NULL DEFAULT 12;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_condition_fair_average_pct numeric(5, 2) NOT NULL DEFAULT 25;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_condition_poor_bad_pct numeric(5, 2) NOT NULL DEFAULT 40;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_levels_two_pct numeric(5, 2) NOT NULL DEFAULT 15;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_carpet_steam_per_bedroom_aud numeric(10, 2) NOT NULL DEFAULT 120;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_walls_per_bedroom_aud numeric(10, 2) NOT NULL DEFAULT 45;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_windows_per_bedroom_aud numeric(10, 2) NOT NULL DEFAULT 40;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_addon_oven_aud numeric(10, 2) NOT NULL DEFAULT 55;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_addon_balcony_aud numeric(10, 2) NOT NULL DEFAULT 45;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_addon_garage_aud numeric(10, 2) NOT NULL DEFAULT 55;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_addon_laundry_aud numeric(10, 2) NOT NULL DEFAULT 45;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_addon_patio_aud numeric(10, 2) NOT NULL DEFAULT 45;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_addon_fridge_aud numeric(10, 2) NOT NULL DEFAULT 35;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_addon_blinds_aud numeric(10, 2) NOT NULL DEFAULT 45;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS daily_digest_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS admin_notify_new_user boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS admin_notify_new_listing boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS admin_notify_dispute boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS allow_low_amount_listings boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS allow_two_minute_auction_test boolean NOT NULL DEFAULT false;

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS default_site_theme text NOT NULL DEFAULT 'dark';

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS new_listing_in_radius_email boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS new_listing_in_radius_in_app boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS new_listing_in_radius_sms boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS new_listing_in_radius_push boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS new_listing_outside_email boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS new_listing_outside_in_app boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS new_listing_outside_sms boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS new_listing_outside_push boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS enable_daily_browse_jobs_nudge boolean NOT NULL DEFAULT true;

-- Launch promo (see supabase/sql/20260426120000_launch_promo.sql + 20260428120000_launch_promo_admin_eligibility.sql)
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS launch_promo_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS launch_promo_ends_at timestamptz NULL;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS launch_promo_free_job_slots smallint NOT NULL DEFAULT 2;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS launch_promo_show_bond_pro_nudge boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS launch_promo_zero_fee_service_types text[] NOT NULL DEFAULT ARRAY['airbnb_turnover', 'recurring_house_cleaning']::text[];
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS launch_promo_marketing_price_cap_aud integer NOT NULL DEFAULT 350;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS launch_promo_marketing_monthly_airbnb_recurring_cap smallint NOT NULL DEFAULT 2;

-- Optional: admin cron status card (not required for save, but often deployed with app)
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS notification_cron_run_status jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Housekeeping timestamps (not sent by save; useful for auditing)
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Constraints (only add if missing)
-- ---------------------------------------------------------------------------

ALTER TABLE public.global_settings DROP CONSTRAINT IF EXISTS global_settings_default_site_theme_check;
ALTER TABLE public.global_settings
  ADD CONSTRAINT global_settings_default_site_theme_check CHECK (default_site_theme IN ('light', 'dark'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'global_settings_payout_schedule_check'
      AND conrelid = 'public.global_settings'::regclass
  ) THEN
    ALTER TABLE public.global_settings
      ADD CONSTRAINT global_settings_payout_schedule_check CHECK (payout_schedule IN ('daily', 'weekly', 'monthly'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Primary key on id (required for PostgREST upsert onConflict: id)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'global_settings'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'global_settings'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE public.global_settings ADD PRIMARY KEY (id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Seed single row so upsert ON CONFLICT (id) can succeed
-- ---------------------------------------------------------------------------

INSERT INTO public.global_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Keep legacy ABN flag aligned when both columns exist
UPDATE public.global_settings
SET abn_required = require_abn
WHERE id = 1
  AND abn_required IS DISTINCT FROM require_abn;

COMMENT ON TABLE public.global_settings IS
  'Single-row (id=1) platform config. Columns must stay in sync with lib/actions/global-settings.ts saveGlobalSettings.';
