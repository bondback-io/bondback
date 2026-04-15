-- Deliver INSERT/UPDATE on job_messages to subscribed clients (postgres_changes in ChatWindow + chat panel).
-- Without this, peers see typing (broadcast) but new messages only after refresh.

DO $pub$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.job_messages;
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END IF;
END
$pub$;
