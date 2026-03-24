/**
 * Server-only. Log admin actions to admin_activity_log for audit.
 * Uses service role client so inserts succeed regardless of RLS.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminActivityPayload = {
  adminId: string | null;
  actionType: string;
  targetType: string | null;
  targetId: string | null;
  details?: Record<string, unknown>;
};

/**
 * Record an admin action. Uses service role so the insert is not blocked by RLS.
 * Safe to call from any admin action; failures are swallowed so the main operation is not affected.
 */
export async function logAdminActivity(payload: AdminActivityPayload): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    await (admin as any).from("admin_activity_log").insert({
      admin_id: payload.adminId,
      action_type: payload.actionType,
      target_type: payload.targetType,
      target_id: payload.targetId,
      details: payload.details ?? {},
    });
  } catch {
    // Swallow so main action is not affected
  }
}

/** Lister/other timer actions — admin_id null; actor in details.actor_user_id. */
export async function logTimerActivity(payload: {
  actorUserId: string;
  actionType: string;
  jobId: number;
  details?: Record<string, unknown>;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    await (admin as any).from("admin_activity_log").insert({
      admin_id: null,
      action_type: payload.actionType,
      target_type: "job",
      target_id: String(payload.jobId),
      details: {
        actor_user_id: payload.actorUserId,
        ...payload.details,
      },
    });
  } catch {
    /* ignore */
  }
}
