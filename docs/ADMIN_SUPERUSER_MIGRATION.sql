-- Admin dashboard: is_admin, is_banned, and assign super user.
-- Run in Supabase SQL editor. RLS: restrict updates to is_admin/is_banned to admins or use service role.
--
-- 1. Add is_admin (boolean, default false) if not exists
-- 2. Add is_banned (boolean, default false) if not exists
-- 3. Assign super user: set is_admin = true for bondback2026@gmail.com

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin IS 'Super user / admin dashboard access.';
COMMENT ON COLUMN public.profiles.is_banned IS 'If true, user is banned from the platform.';

-- Assign super user by email (Supabase: auth.users holds email)
UPDATE public.profiles
SET is_admin = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'bondback2026@gmail.com'
);

-- Optional: verify (run separately)
-- SELECT p.id, p.full_name, p.is_admin FROM public.profiles p
-- JOIN auth.users u ON u.id = p.id WHERE u.email = 'bondback2026@gmail.com';
