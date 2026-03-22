-- Partial refund negotiation: add columns and allow status 'dispute_negotiating'.
-- Run in Supabase SQL editor. RLS: only parties + admin can read/update.
--
-- Flow:
-- 1. Lister opens dispute with partial refund slider → status = dispute_negotiating, proposed_refund_amount set.
-- 2. Cleaner: Accept → release agreed amount to cleaner, status = completed; Counter → counter_proposal_amount + message; Reject → escalate to in_review.
-- 3. If both agree on amount → completed; 72h no agreement → auto-escalate to admin (handled by app/cron).

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS proposed_refund_amount integer NULL,
  ADD COLUMN IF NOT EXISTS counter_proposal_amount integer NULL;

-- Ensure jobs.status check constraint allows: accepted, in_progress, completed, disputed, dispute_negotiating, in_review, cancelled
-- If your DB has a CHECK on status, add dispute_negotiating, e.g.:
-- ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
-- ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (status IN ('accepted','in_progress','completed','disputed','dispute_negotiating','in_review','cancelled'));

COMMENT ON COLUMN public.jobs.proposed_refund_amount IS 'Refund amount in cents proposed by lister when opening dispute (partial refund flow).';
COMMENT ON COLUMN public.jobs.counter_proposal_amount IS 'Counter proposal amount in cents from cleaner during negotiation.';
