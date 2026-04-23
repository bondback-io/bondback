-- Per listings.service_type base rate (AUD/bedroom) for new listing suggested price.
-- Missing keys fall back to pricing_base_rate_per_bedroom_aud (see lib/pricing-modifiers.ts).

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS pricing_base_rate_per_bedroom_by_service_type jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.global_settings.pricing_base_rate_per_bedroom_by_service_type IS
  'Optional { "bond_cleaning": n, ... } AUD per bedroom; empty object uses pricing_base_rate_per_bedroom_aud for all.';
