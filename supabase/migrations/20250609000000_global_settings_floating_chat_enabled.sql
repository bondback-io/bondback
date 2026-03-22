-- Admin toggle: show or hide the floating chat (message icon in top nav and floating panel).
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS floating_chat_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.global_settings.floating_chat_enabled IS 'When true, show the floating chat icon in the header and the chat panel. When false, hide both (admin can turn off site-wide).';
