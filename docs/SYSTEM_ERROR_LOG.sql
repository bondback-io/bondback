-- Runtime diagnostics (RLS failures, job/listing fetch errors). Inserts use service role; admins read via RLS.
--
-- Apply in Supabase → SQL Editor, then reload Admin → System errors.
-- Same file as: supabase/sql/20260329120000_system_error_log.sql

create table if not exists public.system_error_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null,
  severity text not null default 'error',
  route_path text,
  job_id integer,
  listing_id uuid,
  message text not null,
  code text,
  details text,
  hint text,
  context jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users (id) on delete set null
);

create index if not exists system_error_log_created_at_idx
  on public.system_error_log (created_at desc);

create index if not exists system_error_log_source_idx
  on public.system_error_log (source);

create index if not exists system_error_log_job_id_idx
  on public.system_error_log (job_id)
  where job_id is not null;

comment on table public.system_error_log is 'Runtime diagnostics (e.g. job detail RLS). Inserted server-side with SUPABASE_SERVICE_ROLE_KEY.';

alter table public.system_error_log enable row level security;

drop policy if exists "Admins can read system_error_log" on public.system_error_log;

create policy "Admins can read system_error_log"
  on public.system_error_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.is_admin::text, ''))) in ('true', 't', '1', 'yes')
    )
  );
