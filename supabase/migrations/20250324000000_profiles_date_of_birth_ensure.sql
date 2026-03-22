-- Ensure date_of_birth exists on profiles (fixes "Could not find date_of_birth in schema cache").
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

COMMENT ON COLUMN public.profiles.date_of_birth IS 'Optional. Used for birthday email trigger (send on DOB).';
