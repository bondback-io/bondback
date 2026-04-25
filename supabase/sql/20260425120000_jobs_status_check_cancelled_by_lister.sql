-- Non-responsive lister escrow cancel sets jobs.status = 'cancelled_by_lister' (lib/actions/jobs.ts).
-- The prior CHECK (20260327120000) omitted this value, causing:
--   new row for relation "jobs" violates check constraint "jobs_status_check"

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (
  status IN (
    'accepted',
    'in_progress',
    'completed_pending_approval',
    'completed',
    'disputed',
    'dispute_negotiating',
    'in_review',
    'cancelled',
    'cancelled_by_lister',
    'refunded',
    'partially_refunded'
  )
);

COMMENT ON CONSTRAINT jobs_status_check ON public.jobs IS
  'Allowed job lifecycle statuses: includes completed_pending_approval, cancelled_by_lister (lister escrow cancel), refunds.';
