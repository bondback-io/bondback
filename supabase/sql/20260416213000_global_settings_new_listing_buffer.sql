-- Additional radius buffer for new-listing cleaner notifications.

alter table public.global_settings
  add column if not exists additional_notification_radius_buffer_km integer not null default 50;

update public.global_settings
set additional_notification_radius_buffer_km = coalesce(additional_notification_radius_buffer_km, 50)
where true;
