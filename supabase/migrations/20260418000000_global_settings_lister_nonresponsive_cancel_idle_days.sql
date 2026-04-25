-- Lister non-responsive escrow cancel: idle 0-7 full days; 0 = no inactivity wait. Default 5.
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS lister_nonresponsive_cancel_idle_days integer
  NOT NULL DEFAULT 5
  CHECK (lister_nonresponsive_cancel_idle_days >= 0 AND lister_nonresponsive_cancel_idle_days <= 7);

COMMENT ON COLUMN public.global_settings.lister_nonresponsive_cancel_idle_days IS
  'Days of no cleaner activity before lister can use non-responsive escrow cancel; 0 = no wait.';
