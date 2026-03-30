-- Optional client/server error breadcrumbs for debugging (safe, non-PII message text).
create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  scope text not null,
  message text,
  context jsonb not null default '{}'::jsonb,
  attempt int,
  max_attempts int
);

create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);
create index if not exists error_logs_user_id_idx on public.error_logs (user_id);

alter table public.error_logs enable row level security;

create policy "Users insert own error_logs"
  on public.error_logs for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

create policy "Users read own error_logs"
  on public.error_logs for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.error_logs is 'Optional diagnostic events from Bond Back clients (retries, failures).';
