-- One counter-offer per party in refund negotiation; lister can flag admin mediation help.

alter table public.jobs
  add column if not exists dispute_cleaner_counter_used boolean not null default false,
  add column if not exists dispute_lister_counter_used boolean not null default false,
  add column if not exists admin_mediation_requested boolean not null default false,
  add column if not exists admin_mediation_requested_at timestamptz;

comment on column public.jobs.dispute_cleaner_counter_used is 'True after cleaner submitted their single counter-offer in the partial-refund flow.';
comment on column public.jobs.dispute_lister_counter_used is 'True after lister submitted their single counter-offer back to the cleaner.';
comment on column public.jobs.admin_mediation_requested is 'Lister requested Bond Back admin to review/mediate (in-app + email to admins).';

-- Existing negotiations: cleaner already sent a counter if amount is on file.
update public.jobs
set dispute_cleaner_counter_used = true
where coalesce(counter_proposal_amount, 0) > 0;

-- Best-effort: thread logged lister counter (after migration deploy).
update public.jobs j
set dispute_lister_counter_used = true
where exists (
  select 1
  from public.dispute_messages m
  where m.job_id = j.id
    and m.body ilike '%Lister counter-offer:%'
);
