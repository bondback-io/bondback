-- Lister escrow cancel (non-responsive cleaner), negative stars, timed bans, audit.

alter table public.profiles
  add column if not exists negative_stars integer not null default 0;

alter table public.profiles
  add column if not exists ban_until timestamptz null;

comment on column public.profiles.negative_stars is 'Strikes from lister escrow cancellations (non-responsive); 3+ may trigger ban.';
comment on column public.profiles.ban_until is 'When set and in the future, cleaner is banned until this time (used with is_banned).';

alter table public.jobs
  add column if not exists escrow_funded_at timestamptz null;

comment on column public.jobs.escrow_funded_at is 'When the initial Pay & Start Job hold was established (first payment_intent on job).';

alter table public.jobs
  add column if not exists lister_escrow_cancelled_at timestamptz null;

alter table public.jobs
  add column if not exists lister_escrow_cancel_fee_cents integer null;

alter table public.jobs
  add column if not exists lister_escrow_cancel_refund_cents integer null;

alter table public.jobs
  add column if not exists lister_escrow_cancel_reason text null;

create table if not exists public.job_lister_cancellation_audit (
  id uuid primary key default gen_random_uuid(),
  job_id integer not null references public.jobs (id) on delete cascade,
  lister_id uuid not null,
  cleaner_id uuid null,
  charge_total_cents integer not null,
  platform_fee_cents integer not null,
  cancellation_fee_cents integer not null,
  refund_cents integer not null,
  platform_fee_percent_snapshot numeric(6, 3) null,
  reason text null,
  cleaner_negative_stars_after integer null,
  cleaner_banned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_lister_cancel_audit_job on public.job_lister_cancellation_audit (job_id);
create index if not exists idx_jobs_lister_escrow_cancelled on public.jobs (lister_escrow_cancelled_at) where lister_escrow_cancelled_at is not null;
