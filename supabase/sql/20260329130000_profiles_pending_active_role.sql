-- Pending role choice (Google / email onboarding): stop defaulting active_role to lister when roles is empty.
-- 1) Legacy: NULL roles meant implicit lister-only — materialize before clearing active_role for empty arrays.
UPDATE public.profiles
SET roles = ARRAY['lister']::text[]
WHERE roles IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN active_role DROP DEFAULT;

ALTER TABLE public.profiles
  ALTER COLUMN active_role DROP NOT NULL;

-- Empty roles[] = user has not chosen Lister vs Cleaner yet — must not show as lister.
UPDATE public.profiles
SET active_role = NULL
WHERE cardinality(roles) = 0;

-- Single-role rows: ensure active_role matches the only role (repair any NULL after ALTER).
UPDATE public.profiles
SET active_role = roles[1]
WHERE cardinality(roles) = 1
  AND roles[1] IN ('lister', 'cleaner')
  AND active_role IS NULL;

COMMENT ON COLUMN public.profiles.active_role IS 'lister | cleaner; NULL when roles is empty (pending first role choice).';
