-- Fair, evidence-based dispute resolution: add columns to jobs table.
-- Run this in Supabase SQL editor. RLS: only parties + admin can read/update dispute fields.
--
-- Summary:
-- 1. After cleaner "Mark Complete", lister has 48h: "Approve & Release Funds" or "Open Dispute".
-- 2. Dispute form: reason (Quality, Timeliness, Damage, Other), mandatory photos, message. Job -> disputed, disputed_at set.
-- 3. Cleaner (or lister if cleaner opened): "Respond to Dispute" with counter-reason, photos, message -> dispute_response_*.
-- 4. Mutual "Accept Resolution" -> dispute_resolution = mutual_agreement, status = completed.
-- 5. 72h no agreement -> escalate to admin (status in_review). 48h no lister action -> auto-release (cron/edge).
-- 6. Admin /admin/disputes: View Evidence (modal: reason + photos + response + response photos), Resolve: Release Funds | Partial Refund | Full Refund | Reject.
--
-- Example dispute form (reason dropdown) JSX:
--   <Select value={reason} onValueChange={setReason}>
--     <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
--     <SelectContent>
--       <SelectItem value="quality">Quality</SelectItem>
--       <SelectItem value="timeliness">Timeliness</SelectItem>
--       <SelectItem value="damage">Damage</SelectItem>
--       <SelectItem value="other">Other</SelectItem>
--     </SelectContent>
--   </Select>
--   <Label>Evidence photos (required)</Label>
--   <input type="file" accept="image/*" multiple />
--   <Textarea placeholder="Message to cleaner (optional)" />
--   <Button onClick={submitDispute}>Submit dispute</Button>

-- Timestamp when dispute was opened (for 72h escalation)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz;

-- Cleaner/lister response to dispute
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS dispute_response_reason text,
  ADD COLUMN IF NOT EXISTS dispute_response_evidence text[],
  ADD COLUMN IF NOT EXISTS dispute_response_message text,
  ADD COLUMN IF NOT EXISTS dispute_response_at timestamptz;

-- Admin resolution (or mutual)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS dispute_resolution text,
  ADD COLUMN IF NOT EXISTS resolution_type text,
  ADD COLUMN IF NOT EXISTS resolution_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_by uuid;

-- Allow status 'in_review' for admin review (after 72h escalation)
-- Ensure jobs.status check constraint allows: accepted, in_progress, completed, disputed, in_review, cancelled

-- Optional: backfill disputed_at for existing disputed jobs
-- UPDATE public.jobs SET disputed_at = updated_at WHERE status = 'disputed' AND disputed_at IS NULL;
