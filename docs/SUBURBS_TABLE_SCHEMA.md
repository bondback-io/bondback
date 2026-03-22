# `suburbs` reference table (Supabase)

This table stores the full list of Australian suburbs (localities) and postcodes.  
It is **read-only reference data** – clients may freely `SELECT`, but only service-role code should insert/update.

## Table definition

Run this SQL in Supabase (Dashboard → SQL editor) against your project:

```sql
create table if not exists public.suburbs (
  id bigint generated always as identity primary key,
  postcode text not null,
  suburb text not null,
  state text not null, -- e.g. NSW, VIC, QLD, WA, SA, TAS, NT, ACT
  lat double precision,
  lon double precision,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.suburbs enable row level security;

-- Allow public read-only access (reference data)
drop policy if exists "Public can select suburbs" on public.suburbs;
create policy "Public can select suburbs"
  on public.suburbs
  for select
  using (true);

-- (No insert/update/delete policies – only service-role code should modify this data.)
```

## Notes

- The `suburbs` table is populated by the `scripts/seed-suburbs.ts` script (see that file for details).
- Frontend code can query this table directly using the **anon** key (read-only), e.g. for suburb autocomplete or radius filtering.
