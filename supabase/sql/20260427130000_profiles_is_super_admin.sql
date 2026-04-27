-- Super admins: full admin access plus restricted tools (e.g. launch promo testing).
-- Grant with: UPDATE public.profiles SET is_super_admin = true WHERE id = '<admin uuid>';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_super_admin IS 'When true (and is_admin), may use super-admin-only tools such as Promo Tools.';
