-- Dispute resolution overhaul: mediation thread + cleaner additional payment requests.

alter table public.jobs
  add column if not exists dispute_priority text not null default 'medium',
  add column if not exists dispute_escalated boolean not null default false,
  add column if not exists dispute_mediation_status text not null default 'none',
  add column if not exists mediation_proposal text,
  add column if not exists mediation_last_activity_at timestamptz;

create table if not exists public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  author_user_id uuid,
  author_role text not null default 'user',
  body text not null,
  attachment_urls text[] not null default '{}',
  is_escalation_event boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists dispute_messages_job_created_idx
  on public.dispute_messages (job_id, created_at asc);

create table if not exists public.cleaner_additional_payment_requests (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  cleaner_id uuid not null references public.profiles(id) on delete cascade,
  lister_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  reason text not null,
  status text not null default 'pending',
  responded_by uuid,
  responded_at timestamptz,
  accepted_checkout_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cleaner_additional_payment_requests_lister_idx
  on public.cleaner_additional_payment_requests (lister_id, created_at desc);

create index if not exists cleaner_additional_payment_requests_job_idx
  on public.cleaner_additional_payment_requests (job_id, created_at desc);

create table if not exists public.dispute_mediation_votes (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  proposal_text text not null,
  refund_cents integer not null default 0,
  additional_payment_cents integer not null default 0,
  lister_accepted boolean,
  cleaner_accepted boolean,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dispute_mediation_votes_job_idx
  on public.dispute_mediation_votes (job_id, created_at desc);
