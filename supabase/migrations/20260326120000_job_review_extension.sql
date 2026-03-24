-- One-time 24h review extension per job (lister); used with extendListerReview24h.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS review_extension_used_at timestamptz;

COMMENT ON COLUMN public.jobs.review_extension_used_at IS 'When the lister used their single "Extend review by 24h" action; null if not used.';
