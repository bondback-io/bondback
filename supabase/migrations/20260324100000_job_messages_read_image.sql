-- Optional image attachments + read receipts for job messenger
ALTER TABLE public.job_messages
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

COMMENT ON COLUMN public.job_messages.image_url IS 'Public URL for an image attachment (bond-back condition-photos bucket).';
COMMENT ON COLUMN public.job_messages.read_at IS 'When the recipient opened/read this message (best-effort).';
