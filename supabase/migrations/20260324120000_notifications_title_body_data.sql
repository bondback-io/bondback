-- Rich notification rows for in-app center, IndexedDB cache, and deep links.
-- Keeps message_text for backward compatibility; title/body mirror UI strings.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.notifications.title IS 'Short label for notification list (e.g. New bid · Job #12).';
COMMENT ON COLUMN public.notifications.body IS 'Body text shown in-app (mirrors message_text when set).';
COMMENT ON COLUMN public.notifications.data IS 'Structured payload: job_id, listing_id, type, etc.';

UPDATE public.notifications
SET
  body = COALESCE(body, NULLIF(trim(message_text), '')),
  title = COALESCE(title, type)
WHERE body IS NULL OR title IS NULL;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
