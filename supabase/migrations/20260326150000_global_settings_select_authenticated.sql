-- Allow any authenticated user to SELECT the singleton global_settings row (id = 1).
-- Previously only admins could read global_settings, so getGlobalSettings() returned null
-- for listers/cleaners; the root layout treated null as "floating chat on" (!== false).
-- After this migration, non-admin sessions can read platform flags (e.g. floating_chat_enabled).

DROP POLICY IF EXISTS "global_settings_select_authenticated_read" ON public.global_settings;
CREATE POLICY "global_settings_select_authenticated_read"
  ON public.global_settings FOR SELECT
  TO authenticated
  USING (id = 1);

COMMENT ON POLICY "global_settings_select_authenticated_read" ON public.global_settings IS
  'Non-admins need to read id=1 for public UI flags (floating chat, fees, etc.). UPDATE remains admin-only.';
