-- Run in Supabase SQL editor or merge into migrations.
-- Prevents duplicate active jobs for the same listing (concurrent auction resolution).

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY listing_id
      ORDER BY id
    ) AS rn
  FROM public.jobs
  WHERE status IS DISTINCT FROM 'cancelled'
)
UPDATE public.jobs j
SET
  status = 'cancelled',
  updated_at = now()
FROM ranked r
WHERE j.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_one_non_cancelled_per_listing
  ON public.jobs (listing_id)
  WHERE status IS DISTINCT FROM 'cancelled';

COMMENT ON INDEX public.jobs_one_non_cancelled_per_listing IS
  'At most one non-cancelled job per listing; enforces idempotent auction close / bid accept.';
