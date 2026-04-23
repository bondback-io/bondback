-- Optional Service Fee % per listing service_type. Empty {} = use platform_fee_percentage for all.
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS platform_fee_percentage_by_service_type jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.global_settings.platform_fee_percentage_by_service_type IS 'Overrides: keys = listings.service_type, values = fee 0–100. Missing key uses platform_fee_percentage. Listing snapshot platform_fee_percentage still wins when set.';
