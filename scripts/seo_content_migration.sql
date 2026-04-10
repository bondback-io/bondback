-- =============================================================================
-- Bond Back: seo_content — generated landing + blog + FAQ JSON (dynamic pages)
-- Run in Supabase SQL Editor after seo_regions / seo_suburbs exist.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.seo_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suburb_id uuid NOT NULL UNIQUE REFERENCES public.seo_suburbs (id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES public.seo_regions (id) ON DELETE CASCADE,
  page_slug text NOT NULL UNIQUE,
  landing jsonb NOT NULL DEFAULT '{}'::jsonb,
  blog_posts jsonb NOT NULL DEFAULT '[]'::jsonb,
  faq_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta_title text,
  meta_description text,
  last_error text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_content_region_id_idx ON public.seo_content (region_id);
CREATE INDEX IF NOT EXISTS seo_content_page_slug_idx ON public.seo_content (page_slug);

ALTER TABLE public.seo_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_content_select_admin" ON public.seo_content;
DROP POLICY IF EXISTS "seo_content_select_public" ON public.seo_content;
DROP POLICY IF EXISTS "seo_content_insert_admin" ON public.seo_content;
DROP POLICY IF EXISTS "seo_content_update_admin" ON public.seo_content;
DROP POLICY IF EXISTS "seo_content_delete_admin" ON public.seo_content;

-- Published SEO HTML is public; writes stay admin-only.
CREATE POLICY "seo_content_select_public"
  ON public.seo_content FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "seo_content_insert_admin"
  ON public.seo_content FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

CREATE POLICY "seo_content_update_admin"
  ON public.seo_content FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

CREATE POLICY "seo_content_delete_admin"
  ON public.seo_content FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

COMMENT ON TABLE public.seo_content IS 'AI/template-generated SEO payloads for /bond-cleaning/[slug]; served dynamically.';
