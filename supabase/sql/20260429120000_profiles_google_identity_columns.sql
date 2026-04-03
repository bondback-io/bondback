-- Structured name + OAuth avatar URL for Google and other providers.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.profiles.first_name IS 'Given name (e.g. Google OAuth given_name).';
COMMENT ON COLUMN public.profiles.last_name IS 'Family name (e.g. Google OAuth family_name).';
COMMENT ON COLUMN public.profiles.avatar_url IS 'OAuth provider profile image URL (e.g. Google picture); distinct from user-uploaded profile_photo_url.';
