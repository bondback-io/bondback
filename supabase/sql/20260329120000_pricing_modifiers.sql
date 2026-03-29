-- Bond Back: listing condition/levels + admin pricing modifiers (global_settings)
-- Apply in Supabase SQL Editor or merge into migrations when the migrations folder is writable.

ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_base_rate_per_bedroom_aud numeric(10, 2) NOT NULL DEFAULT 131;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_base_multiplier numeric(8, 4) NOT NULL DEFAULT 1;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_steaming_rate_per_bedroom_aud numeric(10, 2) NOT NULL DEFAULT 55;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_condition_excellent_very_good_pct numeric(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_condition_good_pct numeric(5, 2) NOT NULL DEFAULT 12;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_condition_fair_average_pct numeric(5, 2) NOT NULL DEFAULT 25;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_condition_poor_bad_pct numeric(5, 2) NOT NULL DEFAULT 40;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_levels_two_pct numeric(5, 2) NOT NULL DEFAULT 15;

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS property_condition text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS property_levels text;

COMMENT ON COLUMN public.listings.property_condition IS 'excellent_very_good | good | fair_average | poor_bad';
COMMENT ON COLUMN public.listings.property_levels IS '1 | 2 (storey count)';
