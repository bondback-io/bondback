-- Run in Supabase SQL editor or merge into supabase/migrations as needed.
-- Per-channel toggles for cleaner new-listing flows (#1 in preferred radius, #2 buffer / browse).

alter table public.global_settings
  add column if not exists new_listing_in_radius_email boolean not null default true,
  add column if not exists new_listing_in_radius_in_app boolean not null default true,
  add column if not exists new_listing_in_radius_sms boolean not null default true,
  add column if not exists new_listing_in_radius_push boolean not null default true,
  add column if not exists new_listing_outside_email boolean not null default true,
  add column if not exists new_listing_outside_in_app boolean not null default true,
  add column if not exists new_listing_outside_sms boolean not null default true,
  add column if not exists new_listing_outside_push boolean not null default true,
  add column if not exists enable_daily_browse_jobs_nudge boolean not null default true;

-- Backfill SMS/push flags only when legacy master was off. Cast via text so this works
-- whether enable_sms_alerts_new_jobs is boolean or (legacy) text.
update public.global_settings
set
  new_listing_in_radius_sms = false,
  new_listing_in_radius_push = false,
  new_listing_outside_sms = false,
  new_listing_outside_push = false
where id = 1
  and lower(trim(coalesce(enable_sms_alerts_new_jobs::text, 'true')))
    in ('false', 'f', '0', 'no');
