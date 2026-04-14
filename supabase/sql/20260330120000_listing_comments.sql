-- Public Q&A on live listings (threaded). Run in Supabase SQL Editor or via migration runner.
-- Realtime: adds table to supabase_realtime publication when present.
--
-- listing_id must match public.listings.id. Bond Back production uses bigint for listings.id;
-- if your database uses uuid for listings.id instead, change listing_id below to uuid.
--
-- If a failed run left listing_comments behind with the wrong column type, drop and re-run:
--   DROP TABLE IF EXISTS public.listing_comments CASCADE;

CREATE TABLE IF NOT EXISTS public.listing_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.listing_comments (id) ON DELETE CASCADE,
  message_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_comments_message_nonempty CHECK (length(trim(message_text)) > 0),
  CONSTRAINT listing_comments_message_max CHECK (char_length(message_text) <= 4000)
);

CREATE INDEX IF NOT EXISTS idx_listing_comments_listing_created
  ON public.listing_comments (listing_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_listing_comments_parent
  ON public.listing_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

COMMENT ON TABLE public.listing_comments IS
  'Public questions and comments on open listings; hidden once a job is assigned.';

ALTER TABLE public.listing_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_comments_select_public" ON public.listing_comments;
CREATE POLICY "listing_comments_select_public"
  ON public.listing_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "listing_comments_insert_own" ON public.listing_comments;
CREATE POLICY "listing_comments_insert_own"
  ON public.listing_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.listing_comments TO anon, authenticated;
GRANT INSERT ON public.listing_comments TO authenticated;

DO $pub$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.listing_comments;
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END IF;
END
$pub$;
