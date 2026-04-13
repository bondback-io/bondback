-- =============================================================================
-- Bond Back: support_tickets table + RLS + support-attachments storage
-- =============================================================================
-- Use when PostgREST returns: "Could not find the table 'public.support_tickets'
-- in the schema cache" (migrations not applied to this Supabase project).
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (idempotent policies via DROP IF EXISTS).
--
-- Admin checks use is_admin::text IN (...), not is_admin = true, so RLS works when
-- profiles.is_admin is text OR boolean (same pattern as global_settings_fix.sql).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  suggested_category text,
  confidence numeric(5,2),
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_suggested_category ON public.support_tickets (suggested_category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets (created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- listings.id is bigint in Bond Back (not uuid). Drop wrong FK/column if a previous run used uuid.
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_listing_id_fkey;
DO $repair$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'support_tickets'
      AND c.column_name = 'listing_id'
      AND c.data_type = 'uuid'
  ) THEN
    ALTER TABLE public.support_tickets DROP COLUMN listing_id;
  END IF;
END;
$repair$;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS job_id integer REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS listing_id bigint REFERENCES public.listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_reason text;

COMMENT ON TABLE public.support_tickets IS 'Contact support form submissions. category = user-selected final; suggested_category/confidence from AI.';
COMMENT ON COLUMN public.support_tickets.suggested_category IS 'AI-suggested category (Dispute, Technical, Billing, Feedback, Other).';
COMMENT ON COLUMN public.support_tickets.confidence IS 'AI confidence 0-100.';
COMMENT ON COLUMN public.support_tickets.email IS 'Contact email for this ticket (pre-filled from profile, editable).';
COMMENT ON COLUMN public.support_tickets.job_id IS 'Optional: related job when user came from a job page.';
COMMENT ON COLUMN public.support_tickets.listing_id IS 'Optional: related listing when relevant.';
COMMENT ON COLUMN public.support_tickets.attachment_urls IS 'Storage object paths in support-attachments bucket.';
COMMENT ON COLUMN public.support_tickets.ai_reason IS 'Short reason from AI categorization (or keyword fallback).';

DROP POLICY IF EXISTS "support_tickets_insert_own" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_select_own" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_select_admin" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_update_admin" ON public.support_tickets;

CREATE POLICY "support_tickets_insert_own"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "support_tickets_select_own"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "support_tickets_select_admin"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND trim(coalesce(profiles.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

CREATE POLICY "support_tickets_update_admin"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND trim(coalesce(profiles.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

-- Storage bucket + policies (attachments)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "support_attachments_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "support_attachments_select_own" ON storage.objects;
DROP POLICY IF EXISTS "support_attachments_select_admin" ON storage.objects;

CREATE POLICY "support_attachments_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "support_attachments_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "support_attachments_select_admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND trim(coalesce(profiles.is_admin::text, '')) IN ('true', 't', 'yes', '1')
    )
  );

-- Refresh PostgREST schema cache so the API sees the new table immediately
NOTIFY pgrst, 'reload schema';
