-- Configurable reminder cadence for live no-bid listing notifications.
alter table if exists public.global_settings
  add column if not exists new_listing_reminder_interval_hours integer not null default 6;

update public.global_settings
set new_listing_reminder_interval_hours = coalesce(new_listing_reminder_interval_hours, 6)
where id = 1;
