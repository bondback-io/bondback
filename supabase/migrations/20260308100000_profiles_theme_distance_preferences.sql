-- Theme (light / dark / system) and distance label unit (km / mi) for display.
alter table public.profiles add column if not exists theme_preference text default 'system';
alter table public.profiles add column if not exists distance_unit text default 'km';

update public.profiles set theme_preference = 'system' where theme_preference is null;
update public.profiles set distance_unit = 'km' where distance_unit is null;

-- Validate existing rows (ignore if constraint already exists)
do $$
begin
  alter table public.profiles
    add constraint profiles_theme_preference_check
    check (theme_preference in ('light', 'dark', 'system'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_distance_unit_check
    check (distance_unit in ('km', 'mi'));
exception
  when duplicate_object then null;
end $$;
