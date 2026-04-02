"use server";

import type { Session } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getNotificationPrefs } from "@/lib/supabase/admin";
import { buildTutorialEmail, buildWelcomeEmail, sendEmail } from "@/lib/notifications/email";

type TutorialRole = "lister" | "cleaner";

function prefsRecord(prefs: Record<string, boolean | undefined> | null | undefined) {
  return { ...(prefs ?? {}) } as Record<string, boolean | undefined>;
}

/**
 * Resolve recipient email and whether the address is confirmed for transactional onboarding emails.
 *
 * Order (merge with OR for `emailConfirmed`):
 * 1) `createServerSupabaseClient().auth.getUser()` — validates JWT with Auth and returns **fresh**
 *    `email_confirmed_at` (recommended over cookie `session` alone after email confirmation).
 * 2) `auth.admin.getUserById` — authoritative Auth record when service role is available.
 * 3) `session.user` — fallback when the above are unavailable.
 */
async function resolveAuthEmailAndConfirmed(
  userId: string,
  session: Session
): Promise<{ email: string | null; emailConfirmed: boolean }> {
  let email: string | null = null;
  let emailConfirmed = false;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error && user?.id === userId) {
      email = user.email ?? null;
      emailConfirmed = Boolean(user.email_confirmed_at);
      console.info("[email:auth-resolve] getUser", {
        userId,
        emailConfirmed,
        hasEmail: Boolean(email),
        source: "server_getUser",
      });
    } else if (error) {
      console.warn("[email:auth-resolve] getUser error", { userId, message: error.message });
    }
  } catch (e) {
    console.warn("[email:auth-resolve] getUser threw", { userId, message: e instanceof Error ? e.message : String(e) });
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.warn("[email:auth-resolve] getUserById failed; using session JWT if needed", {
        userId,
        message: error.message,
      });
    }
    if (!error && data?.user) {
      const u = data.user;
      email = u.email ?? email;
      emailConfirmed = emailConfirmed || Boolean(u.email_confirmed_at);
      console.info("[email:auth-resolve] admin", {
        userId,
        emailConfirmedFromAdmin: Boolean(u.email_confirmed_at),
        mergedEmailConfirmed: emailConfirmed,
      });
    }
  }

  if (!email) {
    email = session.user.email ?? null;
  }
  emailConfirmed = emailConfirmed || Boolean(session.user.email_confirmed_at);

  if (email && !emailConfirmed) {
    console.warn("[email:auth-resolve] still_unconfirmed_after_merge", {
      userId,
      note: "If Supabase requires confirmed email, onboarding emails may be skipped until Auth shows email_confirmed_at.",
    });
  }

  return { email, emailConfirmed };
}

/**
 * Welcome email: after first role selection (main signup) or onboarding signup completion.
 * Only when email is confirmed (Supabase Auth) and user has not opted out of `email_welcome`.
 */
export async function sendWelcomeEmailAfterRoleChoice(params: {
  userId: string;
  session: Session;
  choice: "lister" | "cleaner" | "both";
  fullName: string | null;
}): Promise<void> {
  const { email, emailConfirmed } = await resolveAuthEmailAndConfirmed(params.userId, params.session);
  if (!email) {
    console.info("[email:welcome]", { outcome: "skipped", userId: params.userId, reason: "no_email" });
    return;
  }
  if (!emailConfirmed) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "email_not_confirmed",
    });
    return;
  }

  const globalSettings = await getGlobalSettings();
  if (globalSettings?.emails_enabled === false) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "global_emails_disabled",
    });
    return;
  }

  const prefs = await getNotificationPrefs(params.userId);
  if (prefs?.notificationPreferences?.email_welcome === false) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "user_pref_email_welcome_off",
    });
    return;
  }
  if (prefs?.emailForceDisabled) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "email_force_disabled",
    });
    return;
  }

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
  const { email, emailConfirmed } = await resolveAuthEmailAndConfirmed(params.userId, params.session);
  if (!email) {
    console.info("[email:tutorial]", { outcome: "skipped", userId: params.userId, reason: "no_email" });
    return;
  }
  if (!emailConfirmed) {
    console.info("[email:tutorial]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "email_not_confirmed",
    });
    return;
  }

  const globalSettings = await getGlobalSettings();
  if (globalSettings?.emails_enabled === false) {
    console.info("[email:tutorial]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "global_emails_disabled",
    });
    return;
  }

  const prefsResult = await getNotificationPrefs(params.userId);
  if (prefsResult?.notificationPreferences?.email_tutorial === false) {
    console.info("[email:tutorial]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "user_pref_email_tutorial_off",
    });
    return;
  }
  if (prefsResult?.emailForceDisabled) {
    console.info("[email:tutorial]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "email_force_disabled",
    });
    return;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error("[email:tutorial]", {
      outcome: "skipped",
      userId: params.userId,
      reason: "no_service_role_admin",
      hint: "Set SUPABASE_SERVICE_ROLE_KEY to send tutorial and persist prefs.",
    });
    return;
  }

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
      } else {
        console.info("[email:tutorial]", {
          outcome: "skipped",
          userId: params.userId,
          role,
          reason: "send_skipped",
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
