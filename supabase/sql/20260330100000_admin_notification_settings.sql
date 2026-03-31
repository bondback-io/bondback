-- Admin email alerts (global_settings row id=1). Defaults ON.
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS admin_notify_new_user boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS admin_notify_new_listing boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS admin_notify_dispute boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.global_settings.admin_notify_new_user IS 'Send admin email when a user completes first role registration';
COMMENT ON COLUMN public.global_settings.admin_notify_new_listing IS 'Send admin email when a lister publishes a new listing';
COMMENT ON COLUMN public.global_settings.admin_notify_dispute IS 'Send admin email when a dispute is opened on a job';
