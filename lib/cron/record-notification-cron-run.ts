import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NotificationCronJobKey } from "@/lib/cron/notification-cron-schedule";

export type CronRunPayload = {
  ok: boolean;
  error?: string | null;
  result?: Record<string, unknown> | null;
};

/**
 * Persists last run snapshot on `global_settings.notification_cron_run_status` (JSON map).
 * Safe to call when column is missing — logs once and returns.
 */
export async function recordNotificationCronRun(
  jobKey: NotificationCronJobKey,
  payload: CronRunPayload
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.warn("[recordNotificationCronRun] no service role; skipping persist", { jobKey });
    return;
  }

  const { data: row, error: readErr } = await admin
    .from("global_settings")
    .select("notification_cron_run_status")
    .eq("id", 1)
    .maybeSingle();

  if (readErr) {
    console.warn("[recordNotificationCronRun] read failed", readErr.message);
    return;
  }

  const prev =
    (row as { notification_cron_run_status?: Record<string, unknown> | null } | null)
      ?.notification_cron_run_status ?? {};
  const entry = {
    last_run_at: new Date().toISOString(),
    ok: payload.ok,
    error: payload.error ?? null,
    result: payload.result ?? null,
  };
  const next = { ...prev, [jobKey]: entry };

  const { error: updErr } = await admin
    .from("global_settings")
    .update({ notification_cron_run_status: next } as never)
    .eq("id", 1);

  if (updErr) {
    console.warn(
      "[recordNotificationCronRun] update failed (apply migration supabase/sql/20260418120000_global_settings_notification_cron_status.sql?)",
      updErr.message
    );
  }
}
