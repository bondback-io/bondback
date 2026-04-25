-- Align lister_nonresponsive_cancel_idle_days default to 0 (run after initial column migration if needed).
ALTER TABLE public.global_settings
  ALTER COLUMN lister_nonresponsive_cancel_idle_days SET DEFAULT 0;

UPDATE public.global_settings
SET lister_nonresponsive_cancel_idle_days = 0
WHERE id = 1;
