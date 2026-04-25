-- Lister "non-responsive cleaner" escrow cancel: idle wait 0–7 full days; 0 = no wait. Default 0.
-- Apply via Supabase SQL editor or merge into migrations as needed.
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS lister_nonresponsive_cancel_idle_days integer
  NOT NULL DEFAULT 0
  CHECK (lister_nonresponsive_cancel_idle_days >= 0 AND lister_nonresponsive_cancel_idle_days <= 7);

COMMENT ON COLUMN public.global_settings.lister_nonresponsive_cancel_idle_days IS
  'Days of no cleaner activity before lister can use non-responsive escrow cancel; 0 = no wait.';
