-- If the column already exists with DEFAULT 5, align default and single row to 0 (no idle wait).
ALTER TABLE public.global_settings
  ALTER COLUMN lister_nonresponsive_cancel_idle_days SET DEFAULT 0;

UPDATE public.global_settings
SET lister_nonresponsive_cancel_idle_days = 0
WHERE id = 1;
