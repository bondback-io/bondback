-- Dispute resolution columns (streamlined workflow)
-- Adds alias columns for evidence/status so new admin + UI can be built

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS dispute_evidence text[],
  ADD COLUMN IF NOT EXISTS dispute_status text;

CREATE INDEX IF NOT EXISTS jobs_disputed_at_idx ON public.jobs(disputed_at DESC);
CREATE INDEX IF NOT EXISTS jobs_dispute_status_idx ON public.jobs(dispute_status);

