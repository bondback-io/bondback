-- Run against Supabase (SQL editor or migration pipeline).
-- Product tour: show once after email verification + first login; resettable via Account → Help.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_seen_onboarding_tour boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.has_seen_onboarding_tour IS 'When true, the role-specific product tour is not auto-shown.';
