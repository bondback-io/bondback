-- Walls & carpet steaming bundle: rate × bedrooms (global_settings)
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_steaming_rate_per_bedroom_aud numeric(10, 2) NOT NULL DEFAULT 55;
