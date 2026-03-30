-- Master Twilio SMS switch + per-notification-type flags (global_settings id=1).
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS enable_sms_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS sms_type_enabled jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.global_settings.enable_sms_notifications IS
  'When false, no Twilio SMS is sent (transactional or new-job alerts).';
COMMENT ON COLUMN public.global_settings.sms_type_enabled IS
  'Per notification type: { "new_bid": true, ... }. Empty {} = all types allowed.';
