-- Control whether lister/cleaner see admin-authored dispute_messages on their timeline.

alter table public.dispute_messages
  add column if not exists visible_to_lister boolean not null default false,
  add column if not exists visible_to_cleaner boolean not null default false;

comment on column public.dispute_messages.visible_to_lister is 'When author_role is admin, lister sees this row on /disputes and job audit only if true.';
comment on column public.dispute_messages.visible_to_cleaner is 'When author_role is admin, cleaner sees this row only if true.';

-- Preserve behaviour for existing rows (party-visible content).
update public.dispute_messages
set visible_to_lister = true,
    visible_to_cleaner = true
where author_role is distinct from 'admin';

update public.dispute_messages
set visible_to_lister = true,
    visible_to_cleaner = true
where author_role = 'admin';
