-- Public marketplace handle for cleaners (bid history, etc.). Stored lowercase; unique case-insensitively.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cleaner_username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_cleaner_username_lower_key
  ON public.profiles (lower(trim(cleaner_username)))
  WHERE cleaner_username IS NOT NULL AND length(trim(cleaner_username)) > 0;

COMMENT ON COLUMN public.profiles.cleaner_username IS
  'Optional unique handle for cleaners on bids/marketplace; lowercase a-z, 0-9, underscore.';
