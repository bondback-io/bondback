## notifications table

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in (
    'job_accepted',
    'new_message',
    'job_completed',
    'payment_released',
    'dispute_opened'
  )),
  job_id bigint references public.jobs (id) on delete cascade,
  message_text text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can see their own notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

create policy "Users can mark their own notifications read"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

