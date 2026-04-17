"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  NOTIFICATION_CRON_JOBS,
  getNextDailyUtcRun,
  type NotificationCronJobKey,
} from "@/lib/cron/notification-cron-schedule";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type StoredNotificationCronRun = {
  last_run_at: string;
  ok: boolean;
  error: string | null;
  result: Record<string, unknown> | null;
};

export type NotificationCronJobReportRow = {
  key: NotificationCronJobKey;
  label: string;
  description: string;
  apiPath: string;
  cronExpressionUtc: string;
  scheduleSummaryUtc: string;
  nextRunUtcIso: string;
  nextRunUtcFormatted: string;
  lastRun: StoredNotificationCronRun | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtcLong(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleString("en-GB", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }) + " (UTC)"
  );
}

export async function getNotificationCronStatusReport(): Promise<
  | { ok: true; jobs: NotificationCronJobReportRow[]; note: string }
  | { ok: false; error: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
    return { ok: false, error: "Admin only." };
  }

  const admin = createSupabaseAdminClient();
  let statusMap: Record<string, StoredNotificationCronRun | undefined> = {};
  if (admin) {
    const { data, error } = await admin
      .from("global_settings")
      .select("notification_cron_run_status")
      .eq("id", 1)
      .maybeSingle();
    if (!error && data) {
      const raw = (data as { notification_cron_run_status?: unknown }).notification_cron_run_status;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        statusMap = raw as Record<string, StoredNotificationCronRun>;
      }
    }
  }

  const jobs: NotificationCronJobReportRow[] = NOTIFICATION_CRON_JOBS.map((def) => {
    const next = getNextDailyUtcRun(def.utcHour, def.utcMinute);
    const nextIso = next.toISOString();
    const last = statusMap[def.key];
    let lastRun: StoredNotificationCronRun | null = null;
    if (
      last &&
      typeof last.last_run_at === "string" &&
      typeof last.ok === "boolean"
    ) {
      lastRun = {
        last_run_at: last.last_run_at,
        ok: last.ok,
        error: typeof last.error === "string" ? last.error : last.error == null ? null : String(last.error),
        result:
          last.result && typeof last.result === "object" && !Array.isArray(last.result)
            ? (last.result as Record<string, unknown>)
            : null,
      };
    }

    return {
      key: def.key,
      label: def.label,
      description: def.description,
      apiPath: def.path,
      cronExpressionUtc: def.cron,
      scheduleSummaryUtc: `${pad2(def.utcHour)}:${pad2(def.utcMinute)} UTC daily`,
      nextRunUtcIso: nextIso,
      nextRunUtcFormatted: formatUtcLong(nextIso),
      lastRun,
    };
  });

  return {
    ok: true,
    jobs,
    note:
      "Schedules match vercel.json (UTC). Last run times are recorded when each cron route completes successfully or with an error. If a job never ran, the row stays empty until the first execution.",
  };
}
