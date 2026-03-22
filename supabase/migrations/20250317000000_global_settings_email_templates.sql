-- Bond Back: add email templates and per-type toggles to global_settings
-- email_templates: jsonb { type: { subject, body, active } }
-- email_type_enabled: jsonb { new_bid: true, new_message: true, ... } (global per-type kill switch)

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS email_templates jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_type_enabled jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.global_settings.email_templates IS 'Admin override: type -> { subject, body, active }. When active and set, used instead of default template.';
COMMENT ON COLUMN public.global_settings.email_type_enabled IS 'Global per-type switch: type -> boolean. When false, no email sent for that type.';
