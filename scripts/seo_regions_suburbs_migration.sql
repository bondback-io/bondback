-- =============================================================================
-- Bond Back: Admin SEO — seo_regions + seo_suburbs (foundation + seed + RLS)
-- =============================================================================
-- Run in Supabase SQL Editor (or supabase db push). Safe to re-run: idempotent
-- seeds use ON CONFLICT.
--
-- "Super admin" here = public.profiles.is_admin truthy (same as other admin SEO
-- tables; supports boolean or text column types).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_regions_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.seo_suburbs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES public.seo_regions (id) ON DELETE CASCADE,
  suburb_name text NOT NULL,
  postcode text NOT NULL,
  slug text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  last_checked timestamptz,
  notes text,
  CONSTRAINT seo_suburbs_region_slug_key UNIQUE (region_id, slug)
);

CREATE INDEX IF NOT EXISTS seo_suburbs_region_id_idx ON public.seo_suburbs (region_id);
CREATE INDEX IF NOT EXISTS seo_suburbs_priority_idx ON public.seo_suburbs (region_id, priority);

COMMENT ON TABLE public.seo_regions IS 'SEO market regions (e.g. Sunshine Coast, Brisbane).';
COMMENT ON TABLE public.seo_suburbs IS 'Per-suburb SEO tracking rows; priority 1 = highest.';

-- -----------------------------------------------------------------------------
-- 2) Seed regions
-- -----------------------------------------------------------------------------
INSERT INTO public.seo_regions (name, slug, is_active)
VALUES
  ('Sunshine Coast QLD', 'sunshine-coast', true),
  ('Brisbane QLD', 'brisbane', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 3) Seed Sunshine Coast — top 25 (priority 1 = highest)
--     Postcodes per Australia Post / common usage for these localities.
-- -----------------------------------------------------------------------------
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Maroochydore', '4558', 'maroochydore', 1),
  ('Mooloolaba', '4557', 'mooloolaba', 2),
  ('Caloundra', '4551', 'caloundra', 3),
  ('Noosa Heads', '4567', 'noosa-heads', 4),
  ('Buderim', '4556', 'buderim', 5),
  ('Kawana Waters', '4575', 'kawana-waters', 6),
  ('Nambour', '4560', 'nambour', 7),
  ('Coolum Beach', '4573', 'coolum-beach', 8),
  ('Birtinya', '4575', 'birtinya', 9),
  ('Sippy Downs', '4556', 'sippy-downs', 10),
  ('Peregian Beach', '4573', 'peregian-beach', 11),
  ('Marcoola', '4564', 'marcoola', 12),
  ('Twin Waters', '4565', 'twin-waters', 13),
  ('Alexandra Headland', '4572', 'alexandra-headland', 14),
  ('Mountain Creek', '4557', 'mountain-creek', 15),
  ('Palmwoods', '4555', 'palmwoods', 16),
  ('Woombye', '4559', 'woombye', 17),
  ('Landsborough', '4550', 'landsborough', 18),
  ('Beerwah', '4519', 'beerwah', 19),
  ('Gympie', '4570', 'gympie', 20),
  ('Montville', '4560', 'montville', 21),
  ('Mapleton', '4560', 'mapleton', 22),
  ('Pelican Waters', '4551', 'pelican-waters', 23),
  ('Warana', '4575', 'warana', 24),
  ('Currimundi', '4551', 'currimundi', 25)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'sunshine-coast'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- -----------------------------------------------------------------------------
-- 4) Seed Brisbane — top 25 (North / Moreton Bay / key growth corridors)
-- -----------------------------------------------------------------------------
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Chermside', '4032', 'chermside', 1),
  ('North Lakes', '4509', 'north-lakes', 2),
  ('Aspley', '4034', 'aspley', 3),
  ('Strathpine', '4500', 'strathpine', 4),
  ('Petrie', '4502', 'petrie', 5),
  ('Kallangur', '4503', 'kallangur', 6),
  ('Caboolture', '4510', 'caboolture', 7),
  ('Morayfield', '4506', 'morayfield', 8),
  ('Redcliffe', '4020', 'redcliffe', 9),
  ('Scarborough', '4020', 'scarborough', 10),
  ('Deception Bay', '4508', 'deception-bay', 11),
  ('Burpengary', '4505', 'burpengary', 12),
  ('Narangba', '4504', 'narangba', 13),
  ('Mango Hill', '4509', 'mango-hill', 14),
  ('Rothwell', '4022', 'rothwell', 15),
  ('Albany Creek', '4035', 'albany-creek', 16),
  ('Bracken Ridge', '4017', 'bracken-ridge', 17),
  ('Sandgate', '4017', 'sandgate', 18),
  ('Nundah', '4012', 'nundah', 19),
  ('Carseldine', '4034', 'carseldine', 20),
  ('Zillmere', '4034', 'zillmere', 21),
  ('Boondall', '4034', 'boondall', 22),
  ('Banyo', '4014', 'banyo', 23),
  ('Nudgee', '4014', 'nudgee', 24),
  ('Chermside West', '4032', 'chermside-west', 25)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'brisbane'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- -----------------------------------------------------------------------------
-- 5) RLS — only super admins (profiles.is_admin) may read/write
-- -----------------------------------------------------------------------------
ALTER TABLE public.seo_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_suburbs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_regions_select_admin" ON public.seo_regions;
DROP POLICY IF EXISTS "seo_regions_insert_admin" ON public.seo_regions;
DROP POLICY IF EXISTS "seo_regions_update_admin" ON public.seo_regions;
DROP POLICY IF EXISTS "seo_regions_delete_admin" ON public.seo_regions;

DROP POLICY IF EXISTS "seo_suburbs_select_admin" ON public.seo_suburbs;
DROP POLICY IF EXISTS "seo_suburbs_insert_admin" ON public.seo_suburbs;
DROP POLICY IF EXISTS "seo_suburbs_update_admin" ON public.seo_suburbs;
DROP POLICY IF EXISTS "seo_suburbs_delete_admin" ON public.seo_suburbs;

CREATE POLICY "seo_regions_select_admin"
  ON public.seo_regions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

CREATE POLICY "seo_regions_insert_admin"
  ON public.seo_regions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

CREATE POLICY "seo_regions_update_admin"
  ON public.seo_regions FOR UPDATE TO authenticated
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

CREATE POLICY "seo_regions_delete_admin"
  ON public.seo_regions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

CREATE POLICY "seo_suburbs_select_admin"
  ON public.seo_suburbs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

CREATE POLICY "seo_suburbs_insert_admin"
  ON public.seo_suburbs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

CREATE POLICY "seo_suburbs_update_admin"
  ON public.seo_suburbs FOR UPDATE TO authenticated
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

CREATE POLICY "seo_suburbs_delete_admin"
  ON public.seo_suburbs FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

-- -----------------------------------------------------------------------------
-- 6) Verification queries (optional — run after migration to confirm)
-- -----------------------------------------------------------------------------
-- Tables:
--   SELECT table_name
--   FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN ('seo_regions', 'seo_suburbs')
--   ORDER BY table_name;
--
-- Regions:
--   SELECT id, name, slug, is_active, created_at FROM public.seo_regions ORDER BY slug;
--
-- Sunshine Coast sample (top 25 by priority):
--   SELECT s.priority, s.suburb_name, s.postcode, s.slug, s.completed
--   FROM public.seo_suburbs s
--   JOIN public.seo_regions r ON r.id = s.region_id
--   WHERE r.slug = 'sunshine-coast'
--   ORDER BY s.priority;
