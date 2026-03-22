# `profiles` table – cleaner profile fields

The app expects these columns on `public.profiles`. Add any that are missing.

## New columns (run in Supabase SQL Editor)

```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_experience integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_photo_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialties text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS portfolio_photo_urls text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS insurance_policy_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipment_notes text;
```

## Storage bucket for profile photos

Create a bucket **`profile-photos`** in Supabase (Dashboard → Storage) and add a policy so authenticated users can upload to their own folder:

- **Path pattern:** `{user_id}/*` (each user can write under their own `id`)
- **Policy:** Allow `INSERT` and `SELECT` where `auth.uid()::text` matches the first path segment.

Example policy (Storage → profile-photos → Policies):

- **Insert:** `bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text`
- **Select:** same or public read if you want profile photos to be viewable by everyone.
