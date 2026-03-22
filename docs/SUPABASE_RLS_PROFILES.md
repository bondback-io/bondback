# Fix: RLS for `profiles` table

If you see **"new row violates row-level security policy for table profiles"** on onboarding, the `profiles` table needs an **INSERT** policy that allows the signed-in user to insert a row where `id` = their user id.

Run this in the Supabase SQL Editor (Dashboard → SQL Editor):

```sql
-- Allow users to insert their own profile row (required for onboarding)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile
DROP POLICY IF EXISTS "Users can select own profile" ON public.profiles;
CREATE POLICY "Users can select own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);
```

Ensure **RLS is enabled** on the table:

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

---

## Optional: add `postcode` column (for suburb autocomplete)

If you want to store postcode from the onboarding autocomplete:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS postcode text;
```

After this, the app will save `postcode` when the user picks a suburb from the Australian list.
