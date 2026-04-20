-- Optional data repair: when `listings.lister_id` drifted from `jobs.lister_id`, My listings
-- could omit jobs until the app fix shipped. Run in Supabase SQL editor after previewing.
--
-- Preview mismatches:
-- SELECT l.id, l.lister_id AS listing_lister, j.lister_id AS job_lister, j.id AS job_id, j.status
-- FROM listings l
-- JOIN jobs j ON j.listing_id = l.id
-- WHERE j.lister_id IS NOT NULL
--   AND l.lister_id IS DISTINCT FROM j.lister_id;

UPDATE listings l
SET lister_id = sub.lister_id
FROM (
  SELECT DISTINCT ON (listing_id)
    listing_id,
    lister_id
  FROM jobs
  WHERE lister_id IS NOT NULL
  ORDER BY listing_id, updated_at DESC NULLS LAST, id DESC
) AS sub
WHERE l.id = sub.listing_id
  AND l.lister_id IS DISTINCT FROM sub.lister_id;
