"use server";

import type { Session } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getNotificationPrefs } from "@/lib/supabase/admin";
import { buildTutorialEmail, buildWelcomeEmail, sendEmail } from "@/lib/notifications/email";

type TutorialRole = "lister" | "cleaner";

function prefsRecord(prefs: Record<string, boolean | undefined> | null | undefined) {
  return { ...(prefs ?? {}) } as Record<string, boolean | undefined>;
}

/**
 * Welcome email: after first role selection (main signup) or onboarding signup completion.
 * Only when email is confirmed (Supabase) and user has not opted out of `email_welcome`.
 */
export async function sendWelcomeEmailAfterRoleChoice(params: {
  userId: string;
  session: Session;
  choice: "lister" | "cleaner" | "both";
  fullName: string | null;
}): Promise<void> {
  const email = params.session.user.email;
  if (!email) return;
  if (!params.session.user.email_confirmed_at) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "email_not_confirmed",
    });
    return;
  }

  const globalSettings = await getGlobalSettings();
  if (globalSettings?.emails_enabled === false) return;

  const prefs = await getNotificationPrefs(params.userId);
  if (prefs?.notificationPreferences?.email_welcome === false) return;
  if (prefs?.emailForceDisabled) return;

  const firstName = params.fullName?.trim()?.split(" ")[0];
  const signupRole = params.choice;
  const { subject, html } = await buildWelcomeEmail(firstName, signupRole);
  const welcomeResult = await sendEmail(email, subject, html, {
    log: { userId: params.userId, kind: "welcome" },
  });
  if (welcomeResult.skipped) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "send_skipped",
    });
  } else if (!welcomeResult.ok) {
    console.error("[email:welcome]", {
      outcome: "failed",
      userId: params.userId,
      error: welcomeResult.error ?? "unknown",
    });
  } else {
    console.info("[email:welcome]", { outcome: "sent", userId: params.userId });
  }
}

function shouldSkipTutorialForRole(
  merged: Record<string, boolean | undefined>,
  role: TutorialRole
): boolean {
  const key = role === "lister" ? "email_tutorial_lister_sent" : "email_tutorial_cleaner_sent";
  return merged[key] === true;
}

/**
 * Role-specific tutorial emails (lister vs cleaner). Tracks
 * `email_tutorial_lister_sent` / `email_tutorial_cleaner_sent` in notification_preferences.
 */
export async function sendTutorialEmailsForRoles(params: {
  userId: string;
  session: Session;
  firstName: string | undefined;
  roles: TutorialRole[];
}): Promise<void> {
  const email = params.session.user.email;
  if (!email) return;
  if (!params.session.user.email_confirmed_at) {
    console.info("[email:tutorial]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "email_not_confirmed",
    });
    return;
  }

  const globalSettings = await getGlobalSettings();
  if (globalSettings?.emails_enabled === false) return;

  const prefsResult = await getNotificationPrefs(params.userId);
  if (prefsResult?.notificationPreferences?.email_tutorial === false) return;
  if (prefsResult?.emailForceDisabled) return;

  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("notification_preferences")
    .eq("id", params.userId)
    .maybeSingle();

  let merged = prefsRecord(
    profile?.notification_preferences as Record<string, boolean | undefined> | null
  );
  let wrote = false;

  const uniqueRoles = [...new Set(params.roles)];

  for (const role of uniqueRoles) {
    if (shouldSkipTutorialForRole(merged, role)) continue;

    const { subject, html } = await buildTutorialEmail(role, params.firstName);
    const result = await sendEmail(email, subject, html, {
      log: { userId: params.userId, kind: `tutorial_${role}` },
    });
    if (!result.ok || result.skipped) {
      if (!result.ok) {
        console.error("[email:tutorial]", {
          outcome: "failed",
          userId: params.userId,
          role,
          error: result.error,
        });
      }
      continue;
    }

    const key = role === "lister" ? "email_tutorial_lister_sent" : "email_tutorial_cleaner_sent";
    merged[key] = true;
    merged.email_tutorial_sent = true;
    wrote = true;
    console.info("[email:tutorial]", { outcome: "sent", userId: params.userId, role });
  }

  if (wrote) {
    await admin
      .from("profiles")
      .update({ notification_preferences: merged as never })
      .eq("id", params.userId);
  }
}
