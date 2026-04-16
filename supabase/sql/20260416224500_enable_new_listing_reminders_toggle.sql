-- Master switch for scheduled no-bid listing reminder notifications.
alter table if exists public.global_settings
  add column if not exists enable_new_listing_reminders boolean not null default true;

update public.global_settings
set enable_new_listing_reminders = coalesce(enable_new_listing_reminders, true)
where id = 1;
