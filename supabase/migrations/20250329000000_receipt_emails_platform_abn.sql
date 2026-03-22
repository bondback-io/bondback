-- Platform ABN for receipts (optional); admin toggle for sending payment receipt emails.
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS platform_abn text,
  ADD COLUMN IF NOT EXISTS send_payment_receipt_emails boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.global_settings.platform_abn IS 'Platform ABN shown on payment receipts (GST/ABN note).';
COMMENT ON COLUMN public.global_settings.send_payment_receipt_emails IS 'When true, send payment receipt emails (with GST/ABN) to lister and cleaner on release; to lister on refund.';
