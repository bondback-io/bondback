-- Backfill jobs.winner_id from the single accepted bid on the same listing (preview, then run UPDATE).
-- Safe when exactly one `accepted` bid exists per listing.

-- Preview:
-- SELECT j.id AS job_id, j.listing_id, j.winner_id AS winner_before, b.cleaner_id AS winner_from_bid
-- FROM public.jobs j
-- INNER JOIN (
--   SELECT listing_id, cleaner_id
--   FROM public.bids
--   WHERE status = 'accepted'
--   GROUP BY listing_id, cleaner_id
--   HAVING count(*) = 1
-- ) b ON b.listing_id = j.listing_id
-- INNER JOIN (
--   SELECT listing_id
--   FROM public.bids
--   WHERE status = 'accepted'
--   GROUP BY listing_id
--   HAVING count(*) = 1
-- ) c ON c.listing_id = j.listing_id
-- WHERE j.winner_id IS NULL
--   AND j.status IS DISTINCT FROM 'cancelled';

WITH winners AS (
  SELECT listing_id, max(cleaner_id) AS cleaner_id
  FROM public.bids
  WHERE status = 'accepted'
  GROUP BY listing_id
  HAVING count(*) = 1
)
UPDATE public.jobs j
SET
  winner_id = w.cleaner_id,
  updated_at = now()
FROM winners w
WHERE j.listing_id = w.listing_id
  AND j.winner_id IS NULL
  AND j.status IS DISTINCT FROM 'cancelled';
