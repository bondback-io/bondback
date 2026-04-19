"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminActivity } from "@/lib/admin-activity-log";
import { resolveDisputeOpenerUserId } from "@/lib/jobs/dispute-opened-by";

const THRESHOLD = 3;
const DAYS = 30;
/** Min time between repeat admin alerts for the same user (while still over threshold). */
const ALERT_COOLDOWN_HOURS = 24;

type JobDisputeRow = {
  id: number;
  lister_id: string;
  winner_id: string | null;
  dispute_opened_by: string | null;
  disputed_at: string | null;
};

/**
 * Count jobs in the last 30 days where each user opened a dispute.
 * Updates `profiles.high_dispute_opens_30d`. For count > THRESHOLD, notifies admins (cooldown).
 * Call from GET/POST /api/cron/abuse-detection (service role).
 */
export async function processDisputeAbuseDetection(): Promise<{
  overThreshold: number;
  alertsSent: number;
  errors?: string[];
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { overThreshold: 0, alertsSent: 0, errors: ["Admin client not configured."] };
  }

  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const errors: string[] = [];

  const { data: jobs, error: jobsError } = await admin
    .from("jobs")
    .select("id, lister_id, winner_id, dispute_opened_by, disputed_at")
    .not("disputed_at", "is", null)
    .gte("disputed_at", cutoff)
    .not("dispute_opened_by", "is", null);

  if (jobsError) {
    return { overThreshold: 0, alertsSent: 0, errors: [jobsError.message] };
  }

  const list = (jobs ?? []) as JobDisputeRow[];
  const openerCounts = new Map<string, number>();

  for (const j of list) {
    if (!j.dispute_opened_by || !j.disputed_at) continue;
    const opener = resolveDisputeOpenerUserId(j);
    if (!opener) continue;
    openerCounts.set(opener, (openerCounts.get(opener) ?? 0) + 1);
  }

  const { data: admins } = await admin.from("profiles").select("id").eq("is_admin", true);

  const adminIds = ((admins ?? []) as { id: string }[]).map((a) => a.id).filter(Boolean);
  if (adminIds.length === 0) {
    errors.push("No admin users found (is_admin).");
  }

  let overThreshold = 0;
  let alertsSent = 0;
  const now = Date.now();
  const cooldownMs = ALERT_COOLDOWN_HOURS * 60 * 60 * 1000;

  for (const [userId, count] of openerCounts) {
    await admin
      .from("profiles")
      .update({
        high_dispute_opens_30d: count,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", userId);

    if (count <= THRESHOLD) continue;

    overThreshold++;

    const { data: prof } = await admin
      .from("profiles")
      .select("last_dispute_abuse_alert_at")
      .eq("id", userId)
      .maybeSingle();

    const lastAlertIso = (prof as { last_dispute_abuse_alert_at?: string | null } | null)
      ?.last_dispute_abuse_alert_at;
    const lastAlert = lastAlertIso ? new Date(lastAlertIso).getTime() : 0;
    const shouldAlert = adminIds.length > 0 && (!lastAlert || now - lastAlert >= cooldownMs);

    if (shouldAlert) {
      await admin
        .from("profiles")
        .update({
          last_dispute_abuse_alert_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", userId);
    }

    if (!shouldAlert) continue;

    const msg = `[Abuse review] User ${userId.slice(0, 8)}… opened ${count} disputes in the last ${DAYS} days (threshold >${THRESHOLD}). Review in Admin → Users.`;

    const rows = adminIds.map((adminId) => ({
      user_id: adminId,
      type: "dispute_opened" as const,
      job_id: null as number | null,
      message_text: msg,
    }));

    const { error: insErr } = await admin.from("notifications").insert(rows as never);
    if (insErr) {
      errors.push(`Notify admins for ${userId}: ${insErr.message}`);
      continue;
    }

    alertsSent++;
    await logAdminActivity({
      adminId: null,
      actionType: "abuse_dispute_threshold",
      targetType: "profile",
      targetId: userId,
      details: { opens_30d: count, threshold: THRESHOLD },
    });
  }

  return { overThreshold, alertsSent, ...(errors.length ? { errors } : {}) };
}
