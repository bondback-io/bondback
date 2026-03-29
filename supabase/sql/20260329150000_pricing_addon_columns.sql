-- Per-bedroom and flat add-on amounts for new listing quotes (global_settings).
-- Apply in Supabase SQL Editor alongside prior pricing modifier migrations.

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
