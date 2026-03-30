-- =============================================================================
-- Bond Back: global_settings – fix "text = boolean" and ensure table + RLS
-- =============================================================================
-- Run in Supabase SQL Editor. Safe to run multiple times.
-- Fixes: drop old policies that use is_admin = true (fails when is_admin is text).
-- =============================================================================

-- 1) Create table only if missing (must exist before we can drop policies)
CREATE TABLE IF NOT EXISTS public.global_settings (
  id integer PRIMARY KEY DEFAULT 1,
  abn_required boolean NOT NULL DEFAULT true,
  platform_fee_percentage numeric(5,2) NOT NULL DEFAULT 12,
  maintenance_active boolean NOT NULL DEFAULT false,
  maintenance_message text,
  emails_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2) Drop every policy that might exist (old and new names)
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.global_settings;
DROP POLICY IF EXISTS "Allow update for admins only" ON public.global_settings;
DROP POLICY IF EXISTS "global_settings_select_admin" ON public.global_settings;
DROP POLICY IF EXISTS "global_settings_update_admin" ON public.global_settings;
DROP POLICY IF EXISTS "global_settings_insert_admin" ON public.global_settings;

-- 3) Add columns if table already existed (safe to run repeatedly)
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS abn_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS platform_fee_percentage numeric(5,2) NOT NULL DEFAULT 12;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS maintenance_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS maintenance_message text;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS emails_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS daily_digest_enabled boolean NOT NULL DEFAULT true;

-- 4) Ensure single row (id = 1); skip if row already present
INSERT INTO public.global_settings (
  id, abn_required, platform_fee_percentage, maintenance_active, maintenance_message,
  emails_enabled, updated_at, updated_by
)
VALUES (1, true, 12, false, NULL, true, now(), NULL)
ON CONFLICT (id) DO NOTHING;

-- 5) RLS: use only text comparisons (no boolean) so profiles.is_admin can be text or boolean so it works if profiles.is_admin is text or boolean
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_settings_select_admin"
  ON public.global_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (trim(coalesce(is_admin::text, '')) IN ('true', 't', 'yes', '1'))
    )
  );

CREATE POLICY "global_settings_update_admin"
  ON public.global_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (trim(coalesce(is_admin::text, '')) IN ('true', 't', 'yes', '1'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (trim(coalesce(is_admin::text, '')) IN ('true', 't', 'yes', '1'))
    )
  );

CREATE POLICY "global_settings_insert_admin"
  ON public.global_settings FOR INSERT TO authenticated
  WITH CHECK (
    id = 1
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (trim(coalesce(is_admin::text, '')) IN ('true', 't', 'yes', '1'))
    )
  );

COMMENT ON TABLE public.global_settings IS 'Single-row (id=1) admin config. updated_by tracks last editor.';
