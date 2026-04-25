-- Australian state/territory for listing location (QLD, NSW, ...). Optional on older rows.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS state text;

COMMENT ON COLUMN public.listings.state IS 'Australian state or territory (e.g. QLD).';
