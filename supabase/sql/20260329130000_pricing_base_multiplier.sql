-- Add base multiplier if you already ran 20260329120000_pricing_modifiers.sql before this column existed.
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS pricing_base_multiplier numeric(8, 4) NOT NULL DEFAULT 1;

-- Optional: align stored base rate with app defaults (legacy-table fit). Uncomment if desired.
-- UPDATE public.global_settings SET pricing_base_rate_per_bedroom_aud = 131 WHERE id = 1;
