-- User verification badges support

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_badges text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_email_verified boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_verification_badges_gin_idx
  ON public.profiles
  USING gin (verification_badges);

