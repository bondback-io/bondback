-- Optional lister narrative for cleaners (public). Separate from special_instructions and legacy description.
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS property_description text;

COMMENT ON COLUMN public.listings.property_description IS
  'Context about the property and clean for cleaners. Not special instructions; legacy description may still exist for older rows.';
