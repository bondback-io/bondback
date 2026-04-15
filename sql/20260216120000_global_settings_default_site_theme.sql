-- Default light/dark appearance for guests and new signups (profiles.theme_preference).
-- Logged-in users keep their profile value; Account settings can override.

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS default_site_theme text NOT NULL DEFAULT 'dark';

ALTER TABLE public.global_settings
  DROP CONSTRAINT IF EXISTS global_settings_default_site_theme_check;

ALTER TABLE public.global_settings
  ADD CONSTRAINT global_settings_default_site_theme_check
  CHECK (default_site_theme IN ('light', 'dark'));

COMMENT ON COLUMN public.global_settings.default_site_theme IS
  'Platform default theme for logged-out visitors and initial profiles.theme_preference on signup. Users may override in account settings.';
