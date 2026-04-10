-- =============================================================================
-- Bond Back: seo_manual_task_state — per-admin, per-region manual SEO task flags
-- Run in Supabase SQL Editor after other SEO tables.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.seo_manual_task_state (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  region_slug text NOT NULL,
  task_key text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, region_slug, task_key)
);

CREATE INDEX IF NOT EXISTS seo_manual_task_state_region_idx
  ON public.seo_manual_task_state (region_slug);

ALTER TABLE public.seo_manual_task_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_manual_task_state_admin_own" ON public.seo_manual_task_state;

CREATE POLICY "seo_manual_task_state_admin_own"
  ON public.seo_manual_task_state FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

COMMENT ON TABLE public.seo_manual_task_state IS 'Admin manual SEO task completion (e.g. GSC URL submission) per region.';
