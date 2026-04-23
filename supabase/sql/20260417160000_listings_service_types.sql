-- Service types, recurring / Airbnb / deep-clean fields, urgency flag.
-- Apply in Supabase SQL editor or merge into migrations. Existing rows default to bond_cleaning.

alter table public.listings
  add column if not exists service_type text not null default 'bond_cleaning',
  add column if not exists recurring_frequency text,
  add column if not exists airbnb_guest_capacity integer,
  add column if not exists airbnb_turnaround_hours integer,
  add column if not exists deep_clean_purpose text,
  add column if not exists is_urgent boolean not null default false;

comment on column public.listings.service_type is
  'bond_cleaning | recurring_house_cleaning | airbnb_turnover | deep_clean';

comment on column public.listings.recurring_frequency is
  'weekly | fortnightly | monthly — when service_type is recurring_house_cleaning';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_service_type_check'
  ) then
    alter table public.listings
      add constraint listings_service_type_check
      check (
        service_type in (
          'bond_cleaning',
          'recurring_house_cleaning',
          'airbnb_turnover',
          'deep_clean'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_recurring_frequency_check'
  ) then
    alter table public.listings
      add constraint listings_recurring_frequency_check
      check (
        recurring_frequency is null
        or recurring_frequency in ('weekly', 'fortnightly', 'monthly')
      );
  end if;
end $$;

create index if not exists listings_service_type_idx on public.listings (service_type);
create index if not exists listings_is_urgent_idx on public.listings (is_urgent) where is_urgent = true;
