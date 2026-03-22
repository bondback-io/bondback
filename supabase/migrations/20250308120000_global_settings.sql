-- Global platform settings (single row, id = 1). Used by admin Settings & Backups.
CREATE TABLE IF NOT EXISTS public.global_settings (
  id integer PRIMARY KEY DEFAULT 1,
  fee_percentage numeric(5,2) NOT NULL DEFAULT 12,
  require_abn boolean NOT NULL DEFAULT true,
  min_profile_completion integer NOT NULL DEFAULT 70,
  auto_release_hours integer NOT NULL DEFAULT 48,
  emails_enabled boolean NOT NULL DEFAULT true,
  announcement_text text,
  announcement_active boolean NOT NULL DEFAULT false,
  maintenance_active boolean NOT NULL DEFAULT false,
  maintenance_message text,
  referral_enabled boolean NOT NULL DEFAULT false,
  referral_referrer_amount numeric(10,2) NOT NULL DEFAULT 20,
  referral_referred_amount numeric(10,2) NOT NULL DEFAULT 10,
  referral_min_job_amount numeric(10,2) NOT NULL DEFAULT 100,
  referral_max_per_user_month integer NOT NULL DEFAULT 10,
  referral_terms_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add columns if table already existed with an older schema
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS fee_percentage numeric(5,2) NOT NULL DEFAULT 12;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS require_abn boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS min_profile_completion integer NOT NULL DEFAULT 70;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS auto_release_hours integer NOT NULL DEFAULT 48;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS emails_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS announcement_text text;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS announcement_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS maintenance_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS maintenance_message text;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_referrer_amount numeric(10,2) NOT NULL DEFAULT 20;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_referred_amount numeric(10,2) NOT NULL DEFAULT 10;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_min_job_amount numeric(10,2) NOT NULL DEFAULT 100;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_max_per_user_month integer NOT NULL DEFAULT 10;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS referral_terms_text text;

-- Ensure single row
INSERT INTO public.global_settings (id, fee_percentage, require_abn, min_profile_completion, auto_release_hours, emails_enabled, announcement_text, announcement_active, maintenance_active, maintenance_message, referral_enabled, referral_referrer_amount, referral_referred_amount, referral_min_job_amount, referral_max_per_user_month, referral_terms_text)
VALUES (1, 12, true, 70, 48, true, NULL, false, false, NULL, false, 20, 10, 100, 10, NULL)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow authenticated read; only admins can update
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for authenticated" ON public.global_settings;
CREATE POLICY "Allow read for authenticated"
  ON public.global_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow update for admins only" ON public.global_settings;
CREATE POLICY "Allow update for admins only"
  ON public.global_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

COMMENT ON TABLE public.global_settings IS 'Single-row platform config: fee %, ABN requirement, maintenance, announcement banner, email defaults, referral settings.';
