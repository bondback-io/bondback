-- Preserve sender role per message for dual-role users on self-assigned jobs.
-- Without this, switching active role relabels historical messages.

ALTER TABLE public.job_messages
ADD COLUMN IF NOT EXISTS sender_role text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_messages_sender_role_check'
  ) THEN
    ALTER TABLE public.job_messages
    ADD CONSTRAINT job_messages_sender_role_check
    CHECK (sender_role IS NULL OR sender_role IN ('lister', 'cleaner'));
  END IF;
END $$;

-- Backfill old rows where role can be inferred from distinct participant ids.
UPDATE public.job_messages jm
SET sender_role = CASE
  WHEN jm.sender_id = j.lister_id THEN 'lister'
  WHEN jm.sender_id = j.winner_id THEN 'cleaner'
  ELSE NULL
END
FROM public.jobs j
WHERE j.id = jm.job_id
  AND jm.sender_role IS NULL
  AND j.lister_id IS DISTINCT FROM j.winner_id;