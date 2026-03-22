-- Run this entire script in Supabase Dashboard → SQL Editor → New query
-- Option A: Creates the table + exposes it in the API (schema cache)

-- 1) Create table and policies
CREATE TABLE IF NOT EXISTS public.email_template_overrides (
  template_key text PRIMARY KEY,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT false,
  type_enabled boolean NOT NULL DEFAULT true,
  send_after text NOT NULL DEFAULT 'instant',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_template_overrides IS 'Admin overrides for email templates (subject, body, active) and per-type send toggle (type_enabled).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_template_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_template_overrides TO service_role;
GRANT SELECT ON public.email_template_overrides TO anon;

ALTER TABLE public.email_template_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for authenticated" ON public.email_template_overrides;
CREATE POLICY "Allow read for authenticated"
  ON public.email_template_overrides FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow insert update delete for admins only" ON public.email_template_overrides;
CREATE POLICY "Allow insert update delete for admins only"
  ON public.email_template_overrides FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND COALESCE(is_admin::text, '') IN ('true', 't', 'yes', '1'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND COALESCE(is_admin::text, '') IN ('true', 't', 'yes', '1'))
  );

-- 2) Optional backfill from global_settings.email_templates (if that column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'global_settings' AND column_name = 'email_templates'
  ) THEN
    INSERT INTO public.email_template_overrides (template_key, subject, body, active, type_enabled, updated_at)
    SELECT
      key,
      COALESCE((val->>'subject')::text, ''),
      COALESCE((val->>'body')::text, ''),
      COALESCE((val->>'active')::text = 'true', false),
      true,
      now()
    FROM (
      SELECT key, val FROM jsonb_each(
        (SELECT email_templates FROM public.global_settings WHERE id = 1 LIMIT 1)
      )
    ) AS kv(key, val)
    ON CONFLICT (template_key) DO UPDATE SET
      subject = EXCLUDED.subject,
      body = EXCLUDED.body,
      active = EXCLUDED.active,
      updated_at = now();
  END IF;
END $$;

-- 3) Add send_after column if missing (when to trigger: instant, 5m, 1h, 1d, etc.)
ALTER TABLE public.email_template_overrides
  ADD COLUMN IF NOT EXISTS send_after text NOT NULL DEFAULT 'instant';

-- 4) Reload PostgREST schema so the table appears in the API
NOTIFY pgrst, 'reload schema';
