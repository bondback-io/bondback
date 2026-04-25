-- =============================================================================
-- Bond Back — consolidated core schema (idempotent)
-- =============================================================================
-- Run in Supabase → SQL Editor as a single script.
--
-- • Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- • Does NOT DROP tables, TRUNCATE, or delete rows.
-- • Assumes auth.users exists (Supabase default) and optional migration bookkeeping
--   (e.g. supabase_migrations) is already in place.
--
-- Disputes: this app stores dispute fields on public.jobs (no separate disputes table).
-- ABN “verified” is represented by verification_badges @> ARRAY['abn_verified']::text[],
--   not a dedicated abn_verified column (see docs/SUPABASE_PERF_INDEXES.sql).
--
-- After running: optionally execute  NOTIFY pgrst, 'reload schema';
--   so PostgREST picks up new columns immediately.
--
-- Legacy DBs: is_admin may be text (e.g. 'true') instead of boolean. Indexes and
--   admin RLS checks below use a text-safe predicate (matches global_settings_fix.sql).
--
-- roles / verification_badges: GIN without an operator class fails if the column is
--   plain text. We use btree indexes so text, text[], and typical legacy schemas work.
--   (For array @> queries at scale, migrate columns to text[] and add GIN(array_ops) later.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) PROFILES — table shell + missing columns
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roles text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS active_role text NOT NULL DEFAULT 'lister',
  ADD COLUMN IF NOT EXISTS abn text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS suburb text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS max_travel_km integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS specialties text[],
  ADD COLUMN IF NOT EXISTS portfolio_photo_urls text[],
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS insurance_policy_number text,
  ADD COLUMN IF NOT EXISTS availability jsonb,
  ADD COLUMN IF NOT EXISTS equipment_notes text,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS email_force_disabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_preferences_locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS expo_push_token text,
  ADD COLUMN IF NOT EXISTS verification_badges text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS is_email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referred_by uuid,
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS account_credit_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS high_dispute_opens_30d integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dispute_abuse_alert_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_payout_schedule text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS distance_unit text DEFAULT 'km';

-- Self-FK (referrer) — add only when missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_referred_by_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_referred_by_fkey
      FOREIGN KEY (referred_by) REFERENCES public.profiles (id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.verification_badges IS
  'Includes abn_verified, id_verified, etc. (no separate abn_verified column).';
COMMENT ON COLUMN public.profiles.notification_preferences IS
  'Per-type email toggles (new_bid, new_message, job_accepted, …).';

-- -----------------------------------------------------------------------------
-- 2) LISTINGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lister_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  suburb text NOT NULL,
  postcode text NOT NULL,
  property_type text NOT NULL,
  bedrooms integer NOT NULL,
  bathrooms integer NOT NULL,
  reserve_cents integer NOT NULL,
  starting_price_cents integer NOT NULL,
  current_lowest_bid_cents integer NOT NULL,
  duration_days integer NOT NULL,
  status text NOT NULL DEFAULT 'live',
  end_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS addons text[],
  ADD COLUMN IF NOT EXISTS special_instructions text,
  ADD COLUMN IF NOT EXISTS move_out_date date,
  ADD COLUMN IF NOT EXISTS photo_urls text[],
  ADD COLUMN IF NOT EXISTS initial_photos text[],
  ADD COLUMN IF NOT EXISTS cover_photo_url text,
  ADD COLUMN IF NOT EXISTS buy_now_cents integer,
  ADD COLUMN IF NOT EXISTS platform_fee_percentage double precision NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS cancelled_early_at timestamptz,
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS state text;

-- -----------------------------------------------------------------------------
-- 3) JOBS (dispute + payment + auto-release live on this table)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  lister_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  winner_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS agreed_amount_cents integer,
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS payment_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS cleaner_confirmed_complete boolean,
  ADD COLUMN IF NOT EXISTS cleaner_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_release_at_original timestamptz,
  ADD COLUMN IF NOT EXISTS review_extension_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS dispute_photos text[],
  ADD COLUMN IF NOT EXISTS dispute_evidence text[],
  ADD COLUMN IF NOT EXISTS dispute_status text,
  ADD COLUMN IF NOT EXISTS dispute_opened_by uuid,
  ADD COLUMN IF NOT EXISTS proposed_refund_amount integer,
  ADD COLUMN IF NOT EXISTS counter_proposal_amount integer,
  ADD COLUMN IF NOT EXISTS dispute_resolution text,
  ADD COLUMN IF NOT EXISTS resolution_type text,
  ADD COLUMN IF NOT EXISTS resolution_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_by uuid;

COMMENT ON COLUMN public.jobs.auto_release_at IS
  'When payment auto-releases if lister does not dispute (pending-review flow).';
COMMENT ON COLUMN public.jobs.completed_at IS 'Cleaner/lister completion timestamp when applicable.';

-- -----------------------------------------------------------------------------
-- 3b) JOB CHECKLIST ITEMS (cleaner toggles; lister reviews on release)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_checklist_items (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  job_id integer NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  label text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_checklist_items_job_id
  ON public.job_checklist_items (job_id);

COMMENT ON TABLE public.job_checklist_items IS
  'Per-job cleaning checklist rows; seeded when job moves to in_progress.';

ALTER TABLE public.job_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_checklist_items_select_parties" ON public.job_checklist_items;
CREATE POLICY "job_checklist_items_select_parties"
  ON public.job_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_checklist_items.job_id
        AND (j.lister_id = auth.uid() OR j.winner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "job_checklist_items_select_admin" ON public.job_checklist_items;
CREATE POLICY "job_checklist_items_select_admin"
  ON public.job_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(COALESCE(p.is_admin::text, ''))) IN ('true', 't', '1', 'yes')
    )
  );

DROP POLICY IF EXISTS "job_checklist_items_insert_parties" ON public.job_checklist_items;
CREATE POLICY "job_checklist_items_insert_parties"
  ON public.job_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_checklist_items.job_id
        AND (j.lister_id = auth.uid() OR j.winner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "job_checklist_items_update_parties" ON public.job_checklist_items;
CREATE POLICY "job_checklist_items_update_parties"
  ON public.job_checklist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_checklist_items.job_id
        AND (j.lister_id = auth.uid() OR j.winner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_checklist_items.job_id
        AND (j.lister_id = auth.uid() OR j.winner_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 4) BIDS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  cleaner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active'
);

-- -----------------------------------------------------------------------------
-- 5) NOTIFICATIONS (depends on jobs for optional job_id FK)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  job_id integer REFERENCES public.jobs (id) ON DELETE SET NULL,
  message_text text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON TABLE public.notifications IS 'In-app notifications (bell, /notifications).';

-- -----------------------------------------------------------------------------
-- 6) EMAIL LOGS + per-job email rate limit
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  subject text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  recipient_email text
);

COMMENT ON TABLE public.email_logs IS 'Outbound notification email audit trail.';
COMMENT ON COLUMN public.email_logs.status IS 'sent | failed | skipped';

CREATE TABLE IF NOT EXISTS public.notification_email_rate_limit (
  job_id integer NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, user_id)
);

COMMENT ON TABLE public.notification_email_rate_limit IS
  'Throttles per-user per-job notification emails (e.g. new_message).';

-- -----------------------------------------------------------------------------
-- 7) Indexes — hot paths (matches perf migrations + your checklist)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_status_end_time
  ON public.listings (status, end_time DESC)
  WHERE cancelled_early_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_lister_created
  ON public.listings (lister_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_postcode
  ON public.listings (postcode);

CREATE INDEX IF NOT EXISTS idx_listings_created_at_desc
  ON public.listings (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_listing_id
  ON public.jobs (listing_id);

CREATE INDEX IF NOT EXISTS idx_jobs_lister_id
  ON public.jobs (lister_id);

CREATE INDEX IF NOT EXISTS idx_jobs_winner_id
  ON public.jobs (winner_id);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created
  ON public.jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_completed_at
  ON public.jobs (completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_status_auto_release
  ON public.jobs (status, auto_release_at DESC)
  WHERE status = 'completed_pending_approval' AND auto_release_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bids_listing_id
  ON public.bids (listing_id);

CREATE INDEX IF NOT EXISTS idx_bids_cleaner_listing
  ON public.bids (cleaner_id, listing_id);

-- IS TRUE only works for boolean; legacy text columns need string comparison
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
  ON public.profiles (is_admin)
  WHERE lower(trim(COALESCE(is_admin::text, ''))) IN ('true', 't', '1', 'yes');

CREATE INDEX IF NOT EXISTS idx_profiles_roles
  ON public.profiles (roles);

CREATE INDEX IF NOT EXISTS idx_profiles_verification_badges
  ON public.profiles (verification_badges);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS notifications_created_at_idx
  ON public.notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_id_is_read_idx
  ON public.notifications (user_id, is_read)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS email_logs_user_id_idx
  ON public.email_logs (user_id);

CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx
  ON public.email_logs (sent_at DESC);

-- -----------------------------------------------------------------------------
-- 8) RLS — notifications & email_logs (service role bypasses RLS on Supabase)
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_email_rate_limit ENABLE ROW LEVEL SECURITY;

-- Notifications: own rows
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications (mark read)" ON public.notifications;
CREATE POLICY "Users can update own notifications (mark read)"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all notifications (admin UI uses session client)
DROP POLICY IF EXISTS "Admins can read all notifications" ON public.notifications;
CREATE POLICY "Admins can read all notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(COALESCE(p.is_admin::text, ''))) IN ('true', 't', '1', 'yes')
    )
  );

-- Email logs: own rows + admins (inserts are typically service-role only)
DROP POLICY IF EXISTS "Users can read own email logs" ON public.email_logs;
CREATE POLICY "Users can read own email logs"
  ON public.email_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all email logs" ON public.email_logs;
CREATE POLICY "Admins can read all email logs"
  ON public.email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(COALESCE(p.is_admin::text, ''))) IN ('true', 't', '1', 'yes')
    )
  );

-- Rate-limit table: RLS enabled with no policies — authenticated clients cannot read/write;
--   server inserts use the service role (bypasses RLS).

-- -----------------------------------------------------------------------------
-- 9) Realtime — notifications stream for bell / React Query
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 10) RPC — unread count (role-filtered bell badge)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_unread_notifications_for_role(
  p_user_id uuid,
  p_active_role text
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.notifications n
  WHERE n.user_id = p_user_id
    AND n.is_read = false
    AND (
      p_active_role IS NULL
      OR trim(p_active_role) = ''
      OR (
        lower(trim(p_active_role)) = 'lister'
        AND n.type NOT IN ('job_accepted', 'job_approved_to_start', 'job_cancelled_by_lister')
        AND (
          n.type <> 'job_completed'
          OR COALESCE(lower(n.message_text), '') NOT LIKE '%the lister extended%'
        )
      )
      OR (
        lower(trim(p_active_role)) = 'cleaner'
        AND n.type NOT IN ('new_bid', 'job_created', 'funds_ready')
        AND (
          n.type <> 'job_completed'
          OR COALESCE(lower(n.message_text), '') LIKE '%the lister extended%'
        )
      )
    );
$$;

COMMENT ON FUNCTION public.count_unread_notifications_for_role(uuid, text) IS
  'Unread count for role-filtered UI (matches filterNotificationsForActiveRole).';

REVOKE ALL ON FUNCTION public.count_unread_notifications_for_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_unread_notifications_for_role(uuid, text) TO authenticated;

-- =============================================================================
-- Done. Optional: NOTIFY pgrst, 'reload schema';
-- =============================================================================
