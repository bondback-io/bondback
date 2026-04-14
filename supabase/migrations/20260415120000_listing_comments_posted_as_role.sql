-- Persist which role the user was acting as when posting Q&A (dual lister/cleaner on same UUID).
-- Fixes: cleaner active + own listing showed as Lister and blocked replies.

ALTER TABLE public.listing_comments
  ADD COLUMN IF NOT EXISTS posted_as_role text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listing_comments_posted_as_role_check'
  ) THEN
    ALTER TABLE public.listing_comments
      ADD CONSTRAINT listing_comments_posted_as_role_check
      CHECK (
        posted_as_role IS NULL
        OR posted_as_role IN ('lister', 'cleaner', 'member')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.listing_comments.posted_as_role IS
  'Role context at post time: lister | cleaner | member. Used when user_id equals lister_id but active role was cleaner.';
