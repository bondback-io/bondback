-- Support ticket threaded replies + status lifecycle enhancements.

ALTER TABLE public.support_tickets
  ALTER COLUMN status SET DEFAULT 'open';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_tickets_status_check'
      AND conrelid = 'public.support_tickets'::regclass
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_status_check
      CHECK (status IN ('open', 'in_progress', 'completed', 'closed'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role text NOT NULL DEFAULT 'user' CHECK (author_role IN ('user','admin','email','system')),
  body text NOT NULL,
  attachment_urls text[] NULL,
  email_from text NULL,
  email_to text[] NULL,
  external_message_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_ticket_messages_external_message_id
  ON public.support_ticket_messages (external_message_id)
  WHERE external_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_created
  ON public.support_ticket_messages (ticket_id, created_at);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_ticket_messages_select_own" ON public.support_ticket_messages;
CREATE POLICY "support_ticket_messages_select_own"
  ON public.support_ticket_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "support_ticket_messages_select_admin" ON public.support_ticket_messages;
CREATE POLICY "support_ticket_messages_select_admin"
  ON public.support_ticket_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
        AND trim(lower(coalesce(p.is_deleted::text, 'false'))) NOT IN ('true', 't', 'yes', '1')
    )
  );

DROP POLICY IF EXISTS "support_ticket_messages_insert_own" ON public.support_ticket_messages;
CREATE POLICY "support_ticket_messages_insert_own"
  ON public.support_ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND author_role = 'user'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "support_ticket_messages_insert_admin" ON public.support_ticket_messages;
CREATE POLICY "support_ticket_messages_insert_admin"
  ON public.support_ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND trim(coalesce(p.is_admin::text, '')) IN ('true', 't', 'yes', '1')
        AND trim(lower(coalesce(p.is_deleted::text, 'false'))) NOT IN ('true', 't', 'yes', '1')
    )
  );
