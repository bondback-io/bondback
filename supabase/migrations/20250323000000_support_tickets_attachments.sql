-- Add optional email, job_id, listing_id, and attachment_urls to support_tickets.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS job_id integer REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS listing_id bigint REFERENCES public.listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_urls text[] DEFAULT '{}';

COMMENT ON COLUMN public.support_tickets.email IS 'Contact email for this ticket (pre-filled from profile, editable).';
COMMENT ON COLUMN public.support_tickets.job_id IS 'Optional: related job when user came from a job page.';
COMMENT ON COLUMN public.support_tickets.listing_id IS 'Optional: related listing when relevant.';
COMMENT ON COLUMN public.support_tickets.attachment_urls IS 'URLs of files uploaded to support-attachments bucket.';

-- Create storage bucket for support form attachments (screenshots, etc.).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder: user_id/filename
CREATE POLICY "support_attachments_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND name LIKE (auth.uid()::text || '/%')
  );

-- Allow users to read their own uploads
CREATE POLICY "support_attachments_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND name LIKE (auth.uid()::text || '/%')
  );

-- Allow admins to read all support attachments
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
