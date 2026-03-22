-- Ensure email_templates and email_type_enabled columns exist (idempotent)
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS email_templates jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_type_enabled jsonb NOT NULL DEFAULT '{}';

-- RPCs to update global_settings email columns without relying on client schema cache.
-- PostgREST validates .update() payloads against the schema cache; calling these
-- RPCs bypasses that so email template toggles work even if cache is stale.

CREATE OR REPLACE FUNCTION public.update_global_settings_email_templates(p_email_template jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.global_settings
  SET email_templates = p_email_template, updated_at = now()
  WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_global_settings_email_type_enabled(p_email_type_enabled jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.global_settings
  SET email_type_enabled = p_email_type_enabled, updated_at = now()
  WHERE id = 1;
END;
$$;

COMMENT ON FUNCTION public.update_global_settings_email_templates(jsonb) IS 'Admin: set email_templates jsonb. Use when schema cache does not include email_templates.';
COMMENT ON FUNCTION public.update_global_settings_email_type_enabled(jsonb) IS 'Admin: set email_type_enabled jsonb. Use when schema cache does not include email_type_enabled.';

GRANT EXECUTE ON FUNCTION public.update_global_settings_email_templates(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_global_settings_email_templates(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_global_settings_email_type_enabled(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_global_settings_email_type_enabled(jsonb) TO service_role;
