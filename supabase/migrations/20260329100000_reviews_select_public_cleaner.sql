-- Public cleaner profiles and marketplace listings need to show written feedback for
-- reviews about cleaners. The existing policy only allows job participants (lister/winner)
-- and admins to read reviews, so anonymous visitors and unrelated users saw empty review
-- lists while profiles.cleaner_total_reviews still showed the correct count.

DROP POLICY IF EXISTS "reviews_select_public_cleaner_reviews" ON public.reviews;
CREATE POLICY "reviews_select_public_cleaner_reviews"
  ON public.reviews
  FOR SELECT
  TO anon, authenticated
  USING (
    COALESCE(reviewee_type, reviewee_role) = 'cleaner'
  );
