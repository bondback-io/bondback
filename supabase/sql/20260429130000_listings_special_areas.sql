-- Keys selected in the "Special areas" step (balcony, garage, laundry, patio) — separate from paid add-ons for display.
-- Apply in Supabase SQL Editor or merge into migrations when running deploy.
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS special_areas text[];

COMMENT ON COLUMN public.listings.special_areas IS
  'Subset of listing add-on keys that were chosen as special areas (not extra charge). Used for UI highlight; addons[] still holds the full price-relevant set.';
