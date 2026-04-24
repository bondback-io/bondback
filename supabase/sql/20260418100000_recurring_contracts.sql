-- Recurring house-clean contracts: parent listing + per-visit jobs (each job may set recurring_occurrence_id).
-- Replaces jobs_one_non_cancelled_per_listing with a partial unique index that allows multiple
-- recurring visit jobs per listing (they carry recurring_occurrence_id IS NOT NULL).
--
-- NOTE: Bond Back production (bondback-mvp) uses bigint for public.listings.id, not uuid.
-- recurring_contracts.listing_id MUST match that type or the FK cannot be created (42804).

-- -----------------------------------------------------------------------------
-- Listings: series bounds captured at publish (start required in app for recurring)
-- -----------------------------------------------------------------------------
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS recurring_series_start_date date,
  ADD COLUMN IF NOT EXISTS recurring_series_end_date date,
  ADD COLUMN IF NOT EXISTS recurring_series_max_occurrences integer,
  ADD COLUMN IF NOT EXISTS recurring_next_occurrence_on date,
  ADD COLUMN IF NOT EXISTS recurring_contract_paused boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.recurring_series_start_date IS 'First scheduled clean date for recurring_house_cleaning listings.';
COMMENT ON COLUMN public.listings.recurring_series_end_date IS 'Optional last date for the recurring series.';
COMMENT ON COLUMN public.listings.recurring_series_max_occurrences IS 'Optional cap on number of paid visits.';
COMMENT ON COLUMN public.listings.recurring_next_occurrence_on IS 'Denormalized next visit date for cards/UI; mirrors recurring_contracts.next_occurrence_on.';
COMMENT ON COLUMN public.listings.recurring_contract_paused IS 'True when recurring_contracts.paused_at is set; denormalized for marketplace cards.';

-- -----------------------------------------------------------------------------
-- recurring_contracts: one row per recurring parent listing
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  lister_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cleaner_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly')),
  agreed_amount_cents integer NOT NULL,
  platform_fee_percentage double precision NOT NULL DEFAULT 12,
  series_start_date date NOT NULL,
  series_end_date date,
  max_occurrences integer,
  visits_completed integer NOT NULL DEFAULT 0,
  paused_at timestamptz,
  resume_scheduled_for date,
  next_occurrence_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_contracts_listing_unique UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS idx_recurring_contracts_lister ON public.recurring_contracts (lister_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_cleaner ON public.recurring_contracts (cleaner_id);

COMMENT ON TABLE public.recurring_contracts IS 'Parent contract for recurring_house_cleaning; drives occurrence schedule and pause/resume.';

-- -----------------------------------------------------------------------------
-- recurring_occurrences: scheduled visits; at most one active job per occurrence
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.recurring_contracts (id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'skipped')),
  job_id integer REFERENCES public.jobs (id) ON DELETE SET NULL,
  skip_reason_key text,
  skip_reason_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_contract ON public.recurring_occurrences (contract_id);
CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_scheduled ON public.recurring_occurrences (contract_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_job ON public.recurring_occurrences (job_id);

-- -----------------------------------------------------------------------------
-- Jobs: link visit jobs to an occurrence (NULL = legacy / non-recurring primary job)
-- -----------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS recurring_occurrence_id uuid REFERENCES public.recurring_occurrences (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_recurring_occurrence ON public.jobs (recurring_occurrence_id);

-- Replace one-job-per-listing constraint: allow many rows when recurring_occurrence_id is set.
DROP INDEX IF EXISTS public.jobs_one_non_cancelled_per_listing;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_one_primary_nonrecurring_job_per_listing
  ON public.jobs (listing_id)
  WHERE status IS DISTINCT FROM 'cancelled' AND recurring_occurrence_id IS NULL;

COMMENT ON INDEX public.jobs_one_primary_nonrecurring_job_per_listing IS
  'At most one non-cancelled primary (non-recurring-visit) job per listing. Recurring visits set recurring_occurrence_id.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.recurring_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_occurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recurring_contracts_select ON public.recurring_contracts;
CREATE POLICY recurring_contracts_select ON public.recurring_contracts
  FOR SELECT USING (lister_id = auth.uid() OR cleaner_id = auth.uid());

DROP POLICY IF EXISTS recurring_contracts_update_lister ON public.recurring_contracts;
CREATE POLICY recurring_contracts_update_lister ON public.recurring_contracts
  FOR UPDATE USING (lister_id = auth.uid());

DROP POLICY IF EXISTS recurring_occurrences_select ON public.recurring_occurrences;
CREATE POLICY recurring_occurrences_select ON public.recurring_occurrences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.recurring_contracts c
      WHERE c.id = contract_id AND (c.lister_id = auth.uid() OR c.cleaner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS recurring_occurrences_update_parties ON public.recurring_occurrences;
CREATE POLICY recurring_occurrences_update_parties ON public.recurring_occurrences
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recurring_contracts c
      WHERE c.id = contract_id AND (c.lister_id = auth.uid() OR c.cleaner_id = auth.uid())
    )
  );

-- Inserts are performed with service role in server actions (bypass RLS).
