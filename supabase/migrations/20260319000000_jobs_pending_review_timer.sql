-- Pending review timer fields for admin overrides
-- Used for the 48-hour window after cleaner marks the checklist complete

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS auto_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_release_at_original timestamptz;

-- Speed up admin pending-review lookups
CREATE INDEX IF NOT EXISTS jobs_auto_release_at_idx
  ON public.jobs (auto_release_at);

