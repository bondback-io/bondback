-- Reviews moderation (Admin > Reviews) + hide moderated rows from public cleaner profile reads.
-- Apply via your usual migration path (Supabase SQL editor or CLI).

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_note text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_admin_list ON public.reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_visibility ON public.reviews (is_hidden, is_approved, is_flagged);

COMMENT ON COLUMN public.reviews.is_approved IS 'When false, review is withheld from public aggregates (pending moderation).';
COMMENT ON COLUMN public.reviews.is_hidden IS 'When true, review is hidden from public profiles and rating aggregates.';
COMMENT ON COLUMN public.reviews.is_flagged IS 'Admin attention; may still be visible until hidden.';

-- Tighten anonymous/authenticated read of marketplace-visible cleaner reviews.
DROP POLICY IF EXISTS "reviews_select_public_cleaner_reviews" ON public.reviews;
CREATE POLICY "reviews_select_public_cleaner_reviews" ON public.reviews FOR SELECT USING (
  COALESCE(reviewee_type, reviewee_role) = 'cleaner'
  AND COALESCE(is_approved, true) = true
  AND COALESCE(is_hidden, false) = false
);

-- Optional: include reviews in Supabase Realtime (dashboard → Database → Replication).
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
