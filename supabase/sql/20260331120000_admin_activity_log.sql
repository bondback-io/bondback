-- Audit trail for admin actions (settings, users, jobs, listings, email templates, etc.).
-- Inserts use the service role from server actions; admins read via RLS.

create table if not exists public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid references auth.users (id) on delete set null,
  action_type text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb
);

create index if not exists admin_activity_log_created_at_idx
  on public.admin_activity_log (created_at desc);

create index if not exists admin_activity_log_admin_id_idx
  on public.admin_activity_log (admin_id)
  where admin_id is not null;

create index if not exists admin_activity_log_action_type_idx
  on public.admin_activity_log (action_type);

comment on table public.admin_activity_log is 'Append-only audit log for admin UI actions (inserted server-side with service role).';

alter table public.admin_activity_log enable row level security;

-- Inserts are performed with SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).

-- Authenticated admins can read the full log (for /admin/activity).
-- is_admin may be boolean or legacy text; cast to text before comparing (avoids 42804).
drop policy if exists "Admins can read admin_activity_log" on public.admin_activity_log;

create policy "Admins can read admin_activity_log"
  on public.admin_activity_log
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
