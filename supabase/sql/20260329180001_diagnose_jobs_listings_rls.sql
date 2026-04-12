-- Diagnostics: run in Supabase SQL Editor to see which policies are active on jobs/listings.
-- If jobs policies still show USING clauses with "EXISTS" and subqueries on listings/jobs/bids,
-- apply supabase/sql/20260329180000_jobs_listings_rls_break_recursion.sql (committing to Git does not update the DB).

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text AS using_expression,
  with_check::text AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('jobs', 'listings', 'bids')
ORDER BY tablename, policyname;

-- Confirm helper functions exist (after applying the break-recursion script):
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'listing_is_marketplace_browseable',
    'listing_has_job_party_for_user',
    'job_listing_has_cleaner_bid'
  )
ORDER BY p.proname;
