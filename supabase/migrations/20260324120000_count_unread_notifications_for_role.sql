-- Run in Supabase SQL editor (or add as a migration) if you use the unread badge RPC.
-- Mirrors lib/notifications/notification-role-filter.ts

CREATE OR REPLACE FUNCTION public.count_unread_notifications_for_role(
  p_user_id uuid,
  p_active_role text
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.notifications n
  WHERE n.user_id = p_user_id
    AND n.is_read = false
    AND (
      p_active_role IS NULL
      OR trim(p_active_role) = ''
      OR (
        lower(trim(p_active_role)) = 'lister'
        AND n.type NOT IN ('job_accepted', 'job_approved_to_start', 'job_cancelled_by_lister')
        AND (
          n.type <> 'job_completed'
          OR COALESCE(lower(n.message_text), '') NOT LIKE '%the lister extended%'
        )
      )
      OR (
        lower(trim(p_active_role)) = 'cleaner'
        AND n.type NOT IN ('new_bid', 'job_created', 'funds_ready')
        AND (
          n.type <> 'job_completed'
          OR COALESCE(lower(n.message_text), '') LIKE '%the lister extended%'
        )
      )
    );
$$;

COMMENT ON FUNCTION public.count_unread_notifications_for_role(uuid, text) IS
  'Unread notification count for role-filtered UI (matches filterNotificationsForActiveRole).';

REVOKE ALL ON FUNCTION public.count_unread_notifications_for_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_unread_notifications_for_role(uuid, text) TO authenticated;
