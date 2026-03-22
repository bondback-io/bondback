-- Optional date of birth for listers and cleaners (birthday emails, etc.).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

COMMENT ON COLUMN public.profiles.date_of_birth IS 'Optional. Used for birthday email trigger (send on DOB).';
