-- Ban tracking columns on profiles (run in Supabase SQL editor).
-- Requires is_admin, is_banned already present (from ADMIN_SUPERUSER_MIGRATION.sql).
--
-- RLS: Only admins should update is_banned, banned_at, banned_reason, banned_by.
-- Application enforces this in server actions; optionally add a policy that allows
-- UPDATE on these columns only when (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS banned_reason text,
  ADD COLUMN IF NOT EXISTS banned_by uuid;

COMMENT ON COLUMN public.profiles.banned_at IS 'When the user was banned (UTC).';
COMMENT ON COLUMN public.profiles.banned_reason IS 'Reason shown to user and stored for audit.';
COMMENT ON COLUMN public.profiles.banned_by IS 'Admin profile id who applied the ban.';

-- Optional: index for filtering banned users
-- CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles (is_banned) WHERE is_banned = true;
