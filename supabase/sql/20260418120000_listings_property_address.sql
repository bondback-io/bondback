-- Optional full street address for job site (cleaner sees after winning). New listing form writes this.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS property_address text;

COMMENT ON COLUMN public.listings.property_address IS 'Full address line (optional); suburb/postcode remain required for marketplace.';
