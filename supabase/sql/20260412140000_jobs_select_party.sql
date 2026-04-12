-- Ensure lister + assigned cleaner can SELECT their job row (same as docs/JOBS_LISTINGS_RLS_PARTY_SELECT.sql).
-- If this policy is missing on the remote DB, `/jobs/[id]` returns 404 for winners unless the
-- service-role fallback runs (requires SUPABASE_SERVICE_ROLE_KEY in server env).
--
-- Apply in Supabase Dashboard → SQL. Git does not apply to the remote DB.

DROP POLICY IF EXISTS "jobs_select_parties" ON public.jobs;
CREATE POLICY "jobs_select_parties"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = lister_id::text
    OR (winner_id IS NOT NULL AND auth.uid()::text = winner_id::text)
  );
