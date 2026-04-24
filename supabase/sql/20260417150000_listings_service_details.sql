-- Optional per-listing JSON for service-specific fields (Airbnb notes, recurring schedule text, deep intensity, etc.).
-- App: lib/listing-service-details.ts, new listing form, job cards.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS service_details jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.listings.service_details IS
  'Versioned JSON (v=1): access_instructions, airbnb_host_notes, recurring_preferred_schedule, deep_clean_intensity, deep_focus_areas, etc.';
