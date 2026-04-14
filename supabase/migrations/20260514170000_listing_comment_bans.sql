-- Q&A moderation support: per-listing cleaner bans.
-- Listers can ban a cleaner from posting/replying in public listing comments.

CREATE TABLE IF NOT EXISTS public.listing_comment_bans (
  listing_id bigint NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_comment_bans_listing
  ON public.listing_comment_bans (listing_id);

ALTER TABLE public.listing_comment_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_comment_bans_select_public" ON public.listing_comment_bans;
CREATE POLICY "listing_comment_bans_select_public"
  ON public.listing_comment_bans FOR SELECT
  USING (true);

GRANT SELECT ON public.listing_comment_bans TO anon, authenticated;
