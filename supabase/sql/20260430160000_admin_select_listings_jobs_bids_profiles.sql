-- Admins (`profiles.is_admin` truthy): unrestricted SELECT on listings, jobs, bids, and profiles
-- when using the normal authenticated Supabase client (no service role required).
--
-- Uses SECURITY DEFINER helper so policies do not recurse into profiles RLS when checking is_admin.
-- Apply in Supabase SQL Editor (pushing the repo does not run this file).

CREATE OR REPLACE FUNCTION public.is_authenticated_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(trim(coalesce(p.is_admin::text, ''))) IN ('true', 't', '1', 'yes')
  );
$$;

COMMENT ON FUNCTION public.is_authenticated_admin() IS
  'True when the current auth user has profiles.is_admin set (boolean or text). Used by RLS policies; bypasses RLS on inner profiles read.';

REVOKE ALL ON FUNCTION public.is_authenticated_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authenticated_admin() TO authenticated;

-- Listings
DROP POLICY IF EXISTS "listings_select_admin" ON public.listings;
CREATE POLICY "listings_select_admin"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (public.is_authenticated_admin());

-- Jobs
DROP POLICY IF EXISTS "jobs_select_admin" ON public.jobs;
CREATE POLICY "jobs_select_admin"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (public.is_authenticated_admin());

-- Bids + profiles: only attach policies when RLS is already enabled (avoid turning RLS on with a
-- single admin-only policy and blocking everyone else).
DO $bids_admin$
BEGIN
  IF (
    SELECT COALESCE(c.relrowsecurity, false)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'bids' AND c.relkind = 'r'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "bids_select_admin" ON public.bids';
    EXECUTE $p$
CREATE POLICY "bids_select_admin"
  ON public.bids
  FOR SELECT
  TO authenticated
  USING (public.is_authenticated_admin());
$p$;
  END IF;
END
$bids_admin$;

DO $profiles_admin$
BEGIN
  IF (
    SELECT COALESCE(c.relrowsecurity, false)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles' AND c.relkind = 'r'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles';
    EXECUTE $p$
CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_authenticated_admin());
$p$;
  END IF;
END
$profiles_admin$;
