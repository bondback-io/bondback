-- Help articles for the Help & Support section (bond cleaning FAQ and guides).

CREATE TABLE IF NOT EXISTS public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL,
  content text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_help_articles_category ON public.help_articles (category);
CREATE INDEX IF NOT EXISTS idx_help_articles_slug ON public.help_articles (slug);
CREATE INDEX IF NOT EXISTS idx_help_articles_published_sort ON public.help_articles (is_published, category, sort_order)
  WHERE is_published = true;

COMMENT ON TABLE public.help_articles IS 'Help centre articles (Markdown content).';
COMMENT ON COLUMN public.help_articles.slug IS 'URL-friendly unique identifier.';
COMMENT ON COLUMN public.help_articles.category IS 'Category for grouping: Getting Started, Lister Guide, Cleaner Guide, etc.';

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

-- Anyone can read published articles.
CREATE POLICY "help_articles_select_published"
  ON public.help_articles
  FOR SELECT
  USING (is_published = true);

-- Only service role / admin can insert/update (no policy = no access for anon/authenticated without service role).
-- Use service role in seed script or admin actions.
