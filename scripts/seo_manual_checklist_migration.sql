-- Run in Supabase SQL editor (or supabase db push) before using Admin > SEO Manager manual checklist.
-- File mirrors intended supabase/migrations entry when migrations folder is writable.

create table if not exists public.seo_manual_checklist (
  task_key text primary key,
  completed_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create index if not exists seo_manual_checklist_updated_at_idx
  on public.seo_manual_checklist (updated_at desc);

alter table public.seo_manual_checklist enable row level security;

drop policy if exists "seo_manual_checklist_select_admin" on public.seo_manual_checklist;
drop policy if exists "seo_manual_checklist_write_admin" on public.seo_manual_checklist;
drop policy if exists "seo_manual_checklist_update_admin" on public.seo_manual_checklist;

-- `profiles.is_admin` may be boolean or text in different envs; avoid coalesce(bool, text).
create policy "seo_manual_checklist_select_admin"
  on public.seo_manual_checklist for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and lower(trim(coalesce(p.is_admin::text, ''))) in ('true', 't', '1', 'yes')
    )
  );

create policy "seo_manual_checklist_write_admin"
  on public.seo_manual_checklist for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and lower(trim(coalesce(p.is_admin::text, ''))) in ('true', 't', '1', 'yes')
    )
  );

create policy "seo_manual_checklist_update_admin"
  on public.seo_manual_checklist for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and lower(trim(coalesce(p.is_admin::text, ''))) in ('true', 't', '1', 'yes')
    )
  );
