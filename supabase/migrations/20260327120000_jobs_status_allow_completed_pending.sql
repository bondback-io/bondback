-- Escrow review step: cleaners move jobs to completed_pending_approval before payment release.
-- Older DBs may have a status CHECK that omits this value, causing updates to fail.

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
    'refunded',
    'partially_refunded'
  )
);

COMMENT ON CONSTRAINT jobs_status_check ON public.jobs IS
  'Allowed job lifecycle statuses; includes completed_pending_approval (lister review / auto-release window).';
