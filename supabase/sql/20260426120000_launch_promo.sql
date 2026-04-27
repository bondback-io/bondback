-- 0% Fee Launch Promo: global toggles + per-user completed-job counters (lister / cleaner).

ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS launch_promo_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS launch_promo_ends_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS launch_promo_free_job_slots smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS launch_promo_show_bond_pro_nudge boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.global_settings.launch_promo_active IS 'When true and within window, listers with remaining slots pay 0% platform fee on checkout/release.';
COMMENT ON COLUMN public.global_settings.launch_promo_ends_at IS 'Promo window ends at this instant (UTC); NULL = no fixed end date.';
COMMENT ON COLUMN public.global_settings.launch_promo_free_job_slots IS 'Max completed jobs per lister (fee side) and per cleaner (display) at 0% fee during promo.';
COMMENT ON COLUMN public.global_settings.launch_promo_show_bond_pro_nudge IS 'After promo ended, dashboard may nudge Bond Pro when true.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS launch_promo_lister_jobs_used smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS launch_promo_cleaner_jobs_used smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.launch_promo_lister_jobs_used IS 'Completed jobs where this user was lister and 0% promo fee applied.';
COMMENT ON COLUMN public.profiles.launch_promo_cleaner_jobs_used IS 'Completed jobs where this user was winning cleaner and lister 0% promo applied.';
