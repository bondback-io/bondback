-- Per listings.service_type bathroom add-on (AUD per bathroom) for new listing suggested price.
-- Defaults when JSON is empty: bond 60, recurring 35, airbnb 55, deep_clean 65 (see lib/pricing-modifiers.ts).

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS pricing_bathroom_rate_per_bathroom_by_service_type jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.global_settings.pricing_bathroom_rate_per_bathroom_by_service_type IS
  'Optional { "bond_cleaning": n, ... } AUD per bathroom; added after bedroom subtotal. Empty uses code defaults per service type.';
