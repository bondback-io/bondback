-- Deadline for lister to complete Pay & Start Job after a job is created in `accepted` (no escrow yet).
alter table public.jobs
  add column if not exists lister_payment_due_at timestamptz null;

comment on column public.jobs.lister_payment_due_at is
  'When status is accepted without payment hold: lister must Pay & Start Job by this time (UTC) or the job is auto-cancelled.';

update public.jobs
set lister_payment_due_at = created_at + interval '7 days'
where status = 'accepted'
  and (payment_intent_id is null or btrim(payment_intent_id) = '')
  and lister_payment_due_at is null;
