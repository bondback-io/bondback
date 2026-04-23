-- Per listings.service_type base multiplier for new listing suggested price (scales rate×beds×condition×levels).
-- Missing keys fall back to pricing_base_multiplier.

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS pricing_base_multiplier_by_service_type jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.global_settings.pricing_base_multiplier_by_service_type IS
  'Optional { "bond_cleaning": n, ... } multiplier ≥ 0.01; empty uses pricing_base_multiplier for all.';
