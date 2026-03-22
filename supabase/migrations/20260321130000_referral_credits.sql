-- Referral tracking on profiles + account credit balance + idempotent reward ledger

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_lower_idx
  ON public.profiles (lower(referral_code))
  WHERE referral_code IS NOT NULL AND length(trim(referral_code)) > 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_credit_cents integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles(referred_by);

COMMENT ON COLUMN public.profiles.referred_by IS 'Profile id of the referrer (set at signup from referral code).';
COMMENT ON COLUMN public.profiles.referral_code IS 'Unique shareable code; lazy-generated when user opens profile.';
COMMENT ON COLUMN public.profiles.account_credit_cents IS 'Platform credit balance in cents (AUD).';

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id integer NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_credit_cents integer NOT NULL CHECK (referred_credit_cents >= 0),
  referrer_credit_cents integer NOT NULL CHECK (referrer_credit_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_rewards_referrer_created_idx
  ON public.referral_rewards(referrer_id, created_at DESC);

COMMENT ON TABLE public.referral_rewards IS 'One row per job when first-completion referral credits were applied; idempotent on job_id.';

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own referral rewards" ON public.referral_rewards;
CREATE POLICY "Users read own referral rewards"
  ON public.referral_rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = referred_user_id OR auth.uid() = referrer_id);

-- Inserts/updates only via service role (server actions)
