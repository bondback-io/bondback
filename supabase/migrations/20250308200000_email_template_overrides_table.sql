-- Email template overrides in a dedicated table so we never depend on global_settings
-- columns or schema cache. One row per template type; admin UI reads/writes this table only.

CREATE TABLE IF NOT EXISTS public.email_template_overrides (
  template_key text PRIMARY KEY,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT false,
  type_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_template_overrides IS 'Admin overrides for email templates (subject, body, active) and per-type send toggle (type_enabled). Replaces global_settings.email_templates and email_type_enabled.';

-- Explicit GRANTs so PostgREST exposes the table in the API (schema cache)
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

-- Optional: backfill from global_settings if those columns exist (run once; harmless if columns missing)
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

-- Tell PostgREST to reload schema so the new table appears in the API immediately
NOTIFY pgrst, 'reload schema';
