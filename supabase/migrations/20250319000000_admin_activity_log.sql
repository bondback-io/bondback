-- Admin audit log: who did what, when (optional table; app writes here when present).
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  target_type text,
  target_id text,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_activity_log_admin_id_idx ON public.admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS admin_activity_log_created_at_idx ON public.admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_activity_log_action_type_idx ON public.admin_activity_log(action_type);

COMMENT ON TABLE public.admin_activity_log IS 'Audit trail of admin actions (settings, job/listing changes). View in Admin > Activity log.';
