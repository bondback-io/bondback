-- Support ticket modernization: priority, auto-close lifecycle, support_messages compatibility view.

alter table public.support_tickets
  add column if not exists priority text not null default 'medium',
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists auto_close_after timestamptz,
  add column if not exists auto_close_warned_at timestamptz,
  add column if not exists closed_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_priority_check'
      and conrelid = 'public.support_tickets'::regclass
  ) then
    alter table public.support_tickets
      add constraint support_tickets_priority_check
      check (priority in ('low', 'medium', 'high', 'urgent'));
  end if;
end $$;

update public.support_tickets
set
  last_activity_at = coalesce(updated_at, created_at, now()),
  auto_close_after = coalesce(auto_close_after, coalesce(updated_at, created_at, now()) + interval '7 days')
where true;

create index if not exists idx_support_tickets_last_activity
  on public.support_tickets (last_activity_at desc);

create index if not exists idx_support_tickets_priority_status
  on public.support_tickets (priority, status, updated_at desc);

create or replace view public.support_messages as
select
  id,
  ticket_id,
  author_user_id,
  author_role,
  body,
  attachment_urls,
  email_from,
  email_to,
  external_message_id,
  created_at
from public.support_ticket_messages;
