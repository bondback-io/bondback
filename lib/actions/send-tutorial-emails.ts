"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getEmailForUserId } from "@/lib/supabase/admin";
import {
  buildTutorialEmail,
  sendEmail,
} from "@/lib/notifications/email";

const HOURS_AFTER_SIGNUP = 24;
const WINDOW_HOURS = 24; // Send to users who signed up between 24h and 48h ago

/**
 * Find profiles that signed up 24–48h ago and haven't received the tutorial email yet.
 * Sends role-specific tutorial email and marks email_tutorial_sent in notification_preferences.
 * Call from a cron (e.g. daily) or manually for testing.
 */
export async function sendScheduledTutorialEmails(): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
}> {
  console.info("[email:tutorial-cron]", { phase: "start" });
  const admin = createSupabaseAdminClient();
  if (!admin) {
    const msg = "Admin client not configured (SUPABASE_SERVICE_ROLE_KEY)";
    console.error("[email:tutorial-cron]", { outcome: "aborted", error: msg });
    return { sent: 0, skipped: 0, errors: [msg] };
  }

  const globalSettings = await getGlobalSettings();
  if (globalSettings?.emails_enabled === false) {
    console.info("[email:tutorial-cron]", {
      outcome: "skipped",
      reason: "global_settings.emails_enabled=false",
    });
    return { sent: 0, skipped: 0, errors: [] };
  }

  const now = new Date();
  const minCreated = new Date(now.getTime() - (HOURS_AFTER_SIGNUP + WINDOW_HOURS) * 60 * 60 * 1000).toISOString();
  const maxCreated = new Date(now.getTime() - HOURS_AFTER_SIGNUP * 60 * 60 * 1000).toISOString();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, active_role, full_name, notification_preferences, email_force_disabled")
    .gte("created_at", minCreated)
    .lte("created_at", maxCreated);

  if (error) {
    console.error("[email:tutorial-cron]", { phase: "query_failed", error: error.message });
    return { sent: 0, skipped: 0, errors: [error.message] };
  }

  const rows = (profiles ?? []) as {
    id: string;
    active_role: "lister" | "cleaner";
    full_name: string | null;
    notification_preferences: Record<string, boolean> | null;
    email_force_disabled: boolean | null;
  }[];

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (row.email_force_disabled === true) {
      skipped++;
      continue;
    }
    const prefs = row.notification_preferences ?? {};
    if (prefs.email_tutorial === false) {
      skipped++;
      continue;
    }

    const role = row.active_role === "cleaner" ? "cleaner" : "lister";
    const roleSentKey =
      role === "lister" ? "email_tutorial_lister_sent" : "email_tutorial_cleaner_sent";
    const prefMap = prefs as Record<string, boolean | undefined>;
    if (prefMap[roleSentKey] === true) {
      skipped++;
      continue;
    }
    if (prefs.email_tutorial_sent === true) {
      skipped++;
      continue;
    }

    const email = await getEmailForUserId(row.id);
    if (!email) {
      skipped++;
      continue;
    }
    const firstName = row.full_name?.trim()?.split(" ")[0];

    try {
      const { subject, html } = await buildTutorialEmail(role, firstName);
      const result = await sendEmail(email, subject, html, {
        log: { userId: row.id, kind: `tutorial_${role}` },
      });
      if (!result.ok) {
        console.error("[email:tutorial]", {
          outcome: "failed",
          userId: row.id,
          role,
          error: result.error,
        });
        errors.push(`${row.id}: ${result.error}`);
        continue;
      }
      if (result.skipped) {
        skipped++;
        continue;
      }
      const newPrefs = {
        ...prefs,
        email_tutorial_sent: true,
        [role === "lister" ? "email_tutorial_lister_sent" : "email_tutorial_cleaner_sent"]: true,
      };
      await admin
        .from("profiles")
        .update({ notification_preferences: newPrefs })
        .eq("id", row.id);
      sent++;
    } catch (e) {
      errors.push(`${row.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const summary = { sent, skipped, errors };
  console.info("[email:tutorial-cron]", { phase: "complete", ...summary });
  return summary;
}
