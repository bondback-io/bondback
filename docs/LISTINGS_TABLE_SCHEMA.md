# `listings` table schema (Supabase)

The app expects a table **`public.listings`** with the columns below. Column names must be **snake_case**. If you get "Could not find the 'X' column" errors, run the SQL in Supabase (Dashboard → SQL Editor) to create or alter the table.

## Full table (create or replace)

```sql
-- Drop only if you want to recreate from scratch (removes data)
-- DROP TABLE IF EXISTS public.bids;
-- DROP TABLE IF EXISTS public.listings;

CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lister_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  suburb text NOT NULL,
  postcode text NOT NULL,
  property_type text NOT NULL,
  bedrooms integer NOT NULL,
  bathrooms integer NOT NULL,
  addons text[],
  special_instructions text,
  move_out_date date,
  photo_urls text[],
  initial_photos text[],
  reserve_cents integer NOT NULL,
  reserve_price integer NOT NULL,
  buy_now_cents integer,
  base_price integer NOT NULL,
  starting_price_cents integer NOT NULL,
  current_lowest_bid_cents integer NOT NULL,
  duration_days integer NOT NULL,
  status text NOT NULL DEFAULT 'live',
  end_time timestamptz NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add missing columns if the table already exists (run as needed)
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS buy_now_cents integer;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS reserve_price integer;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS base_price integer;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS current_lowest_bid_cents integer;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS starting_price_cents integer;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS duration_days integer;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS status text DEFAULT 'live';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS end_time timestamptz;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS initial_photos text[];
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS cover_photo_url text;
-- etc. for any other column you're missing
```

**Initial condition photos:** To persist photos uploaded on new listing creation, the `initial_photos` column must exist. Run: `ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS initial_photos text[];`

## Column list (for reference)

| Column (snake_case)     | Type        | Notes                    |
|------------------------|-------------|--------------------------|
| id                     | uuid        | Default gen_random_uuid()|
| lister_id              | uuid        | FK auth.users            |
| title                  | text        |                          |
| description            | text        | Nullable                 |
| suburb                 | text        |                          |
| postcode               | text        |                          |
| property_type          | text        | e.g. apartment, house    |
| bedrooms               | integer     |                          |
| bathrooms              | integer     |                          |
| addons                 | text[]      | Nullable                 |
| special_instructions  | text        | Nullable                 |
| move_out_date          | date        | Nullable                 |
| photo_urls             | text[]      | Nullable                 |
| initial_photos         | text[]      | Nullable; condition-before photos from new listing |
| cover_photo_url        | text        | Nullable; default/cover photo URL for listing cards |
| reserve_cents          | integer     |                          |
| reserve_price          | integer     | NOT NULL (reserve in cents) |
| buy_now_cents          | integer     | Nullable                 |
| base_price             | integer     | NOT NULL (same as starting in cents) |
| starting_price_cents   | integer     |                          |
| current_lowest_bid_cents | integer   |                          |
| duration_days          | integer     |                          |
| status                 | text        | e.g. live, ended         |
| end_time               | timestamptz |                          |
| end_date               | date        | NOT NULL (date part of end_time) |
| created_at             | timestamptz | Default now()            |

The **new listing form** builds rows with `lib/listings.ts` → `buildListingInsertRow()` (columns aligned with generated `types/supabase.ts` → `listings.Insert`) and persists them via the server action **`createListingForPublish`** in `lib/actions/listings.ts` (not the browser client), so publishing works with RLS and avoids stray/unknown columns.

### Row Level Security (listers must insert/update)

If `ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY` is on and only marketplace **SELECT** policies exist, **INSERT** from the app will fail until listers can write their own rows. Run **`supabase/sql/20260413120000_listings_rls_lister_insert_update.sql`** in the Supabase SQL editor, or ensure **`SUPABASE_SERVICE_ROLE_KEY`** is set on the server (the publish action uses it when available).
