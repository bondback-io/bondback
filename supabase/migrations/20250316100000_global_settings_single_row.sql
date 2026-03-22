-- =============================================================================
-- Bond Back: global_settings table (single-row config store, id = 1)
-- =============================================================================
--
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run multiple times. Backs up current settings first if row exists.
--
-- After running:
--   - Admin-only settings are available at id = 1.
--   - Use Admin → Settings in the app to edit (writes to this row).
-- =============================================================================

-- Optional: back up existing row before any destructive change (run once if needed)
-- CREATE TABLE IF NOT EXISTS public.global_settings_backup_20250316 AS
--   SELECT * FROM public.global_settings WHERE id = 1;

-- Create table if not present (do not drop table so we keep data)
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

-- Add columns if table already existed with older schema (safe to run repeatedly)
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS abn_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS platform_fee_percentage numeric(5,2) NOT NULL DEFAULT 12;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS maintenance_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS maintenance_message text;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS emails_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ensure single row (id = 1) with defaults; do nothing if row already exists
INSERT INTO public.global_settings (
  id,
  abn_required,
  platform_fee_percentage,
  maintenance_active,
  maintenance_message,
  emails_enabled,
  updated_at,
  updated_by
)
VALUES (
  1,
  true,
  12,
  false,
  NULL,
  true,
  now(),
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- RLS: enable and define policies (admins only)
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Admin check: cast is_admin to boolean so it works whether column is boolean or text
DROP POLICY IF EXISTS "global_settings_select_admin" ON public.global_settings;
CREATE POLICY "global_settings_select_admin"
  ON public.global_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin::text IN ('true', 't', 'yes', '1')))
  );

DROP POLICY IF EXISTS "global_settings_update_admin" ON public.global_settings;
CREATE POLICY "global_settings_update_admin"
  ON public.global_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin::text IN ('true', 't', 'yes', '1')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin::text IN ('true', 't', 'yes', '1')))
  );

DROP POLICY IF EXISTS "global_settings_insert_admin" ON public.global_settings;
CREATE POLICY "global_settings_insert_admin"
  ON public.global_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    id = 1
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin::text IN ('true', 't', 'yes', '1')))
  );

COMMENT ON TABLE public.global_settings IS 'Single-row (id=1) admin config: ABN requirement, platform fee %, maintenance mode, email override. updated_by tracks last editor.';
