-- Pending role choice (Google / email onboarding): stop defaulting active_role to lister when roles is empty.
--
-- `cardinality(roles)` only works when `roles` is a PostgreSQL array (`text[]`). Some databases store
-- `roles` as `text` (JSON string). This script detects the column type and runs the matching branch.

-- 1) Legacy: NULL roles meant implicit lister-only — materialize before clearing active_role for empty arrays.
DO $$
DECLARE
  typ name;
BEGIN
  SELECT t.typname INTO typ
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relname = 'profiles' AND a.attname = 'roles' AND NOT a.attisdropped;

  IF typ IS NULL THEN
    RAISE EXCEPTION 'public.profiles.roles column not found';
  ELSIF typ = '_text' THEN
    UPDATE public.profiles SET roles = ARRAY['lister']::text[] WHERE roles IS NULL;
  ELSIF typ = 'text' THEN
    UPDATE public.profiles SET roles = '["lister"]' WHERE roles IS NULL;
  ELSE
    RAISE NOTICE 'profiles.roles has type % — skipping NULL backfill; alter column to text[] or text (JSON) if needed', typ;
  END IF;
END $$;

ALTER TABLE public.profiles
  ALTER COLUMN active_role DROP DEFAULT;

ALTER TABLE public.profiles
  ALTER COLUMN active_role DROP NOT NULL;

-- Empty roles = user has not chosen Lister vs Cleaner yet — must not show as lister.
DO $$
DECLARE
  typ name;
BEGIN
  SELECT t.typname INTO typ
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relname = 'profiles' AND a.attname = 'roles' AND NOT a.attisdropped;

  IF typ = '_text' THEN
    UPDATE public.profiles SET active_role = NULL WHERE cardinality(roles) = 0;

    UPDATE public.profiles
    SET active_role = roles[1]
    WHERE cardinality(roles) = 1
      AND roles[1] IN ('lister', 'cleaner')
      AND active_role IS NULL;
  ELSIF typ = 'text' THEN
    UPDATE public.profiles
    SET active_role = NULL
    WHERE roles IS NULL
       OR btrim(roles) IN ('[]', 'null', '')
       OR roles ~ '^\s*\[\s*\]\s*$';

    -- Single-element JSON arrays like ["lister"] — avoid ::jsonb on rows that might not be valid JSON.
    UPDATE public.profiles
    SET active_role = (regexp_match(roles, '"\s*((?:lister|cleaner))\s*"'))[1]
    WHERE active_role IS NULL
      AND roles IS NOT NULL
      AND roles ~ '^\s*\[\s*"[^"]*"\s*\]\s*$'
      AND (regexp_match(roles, '"\s*((?:lister|cleaner))\s*"'))[1] IN ('lister', 'cleaner');
  ELSE
    RAISE NOTICE 'profiles.roles has type % — skipping active_role updates; run a manual fix', typ;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.active_role IS 'lister | cleaner; NULL when roles is empty (pending first role choice).';
