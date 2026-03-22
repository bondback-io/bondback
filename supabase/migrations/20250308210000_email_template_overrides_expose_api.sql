-- Run this if email_template_overrides exists but API still says "could not find table in schema cache".
-- Grants ensure PostgREST exposes the table; NOTIFY forces an immediate schema reload.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_template_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_template_overrides TO service_role;
GRANT SELECT ON public.email_template_overrides TO anon;

NOTIFY pgrst, 'reload schema';
