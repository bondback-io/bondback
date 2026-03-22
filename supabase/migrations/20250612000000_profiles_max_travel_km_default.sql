-- Ensure max_travel_km exists with default 30 for new rows (cleaner travel radius in km).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_travel_km integer DEFAULT 30;

COMMENT ON COLUMN public.profiles.max_travel_km IS 'Max travel radius in km for cleaners (5–100). Used for job matching and "new job near you" SMS.';
