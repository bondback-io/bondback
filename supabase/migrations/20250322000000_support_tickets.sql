-- Support tickets (contact form submissions) with AI categorization.

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

COMMENT ON TABLE public.support_tickets IS 'Contact support form submissions. category = user-selected final; suggested_category/confidence from AI.';
COMMENT ON COLUMN public.support_tickets.suggested_category IS 'AI-suggested category (Dispute, Technical, Billing, Feedback, Other).';
COMMENT ON COLUMN public.support_tickets.confidence IS 'AI confidence 0-100.';

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_insert_own"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "support_tickets_select_own"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all (via service role or is_admin check in app; for RLS we allow authenticated to select if they are the user; admin reads via service role or a separate policy).
-- Allow admins to select all: use a policy that checks profiles.is_admin.
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
