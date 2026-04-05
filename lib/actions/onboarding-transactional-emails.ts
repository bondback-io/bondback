/** Server-only module (imported from Route Handlers and server actions). Not a client boundary. */

import type { Session } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getNotificationPrefs } from "@/lib/supabase/admin";
import { buildTutorialEmail, buildWelcomeEmail, sendEmail } from "@/lib/notifications/email";
import type { ProfileRole } from "@/lib/types";
import { normalizeProfileRolesFromDb } from "@/lib/profile-roles";

type TutorialRole = "lister" | "cleaner";

const WELCOME_SENT_KEY = "email_welcome_sent" as const;

/**
 * Set on `signUp({ options: { data: { pending_role } } })` so the role-specific tutorial can send
 * at email confirmation when `profiles.roles` is still empty (Path 1). Path 2 also sets this as a
 * fallback if profile reads lag.
 */
function tutorialRolesFromPendingMetadata(meta: Record<string, unknown> | undefined): TutorialRole[] {
  if (!meta) return [];
  const r = meta.pending_role;
  if (r === "lister" || r === "cleaner") return [r];
  if (r === "both") return ["lister", "cleaner"];
  return [];
}

function prefsRecord(prefs: Record<string, boolean | undefined> | null | undefined) {
  return { ...(prefs ?? {}) } as Record<string, boolean | undefined>;
}

function logEmailEnvSnapshot(context: string) {
  console.info("[email:onboarding:env]", {
    context,
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    hasResendKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    resendFrom: process.env.RESEND_FROM?.trim() || "(default Bond Back <noreply@bondback.io>)",
  });
}

/**
 * Resolve recipient email for **tutorial** (after role selection). Prefers service_role
 * `getUserById` so we always have the address in server actions / Route Handlers.
 */
async function resolveRecipientEmailForTutorial(
  userId: string,
  session: Session
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (!error && data?.user?.email?.trim()) {
      console.info("[email:auth-resolve] tutorial_recipient", {
        userId,
        source: "admin_getUserById",
        hasEmail: true,
      });
      return data.user.email.trim();
    }
    if (error) {
      console.warn("[email:auth-resolve] getUserById failed", { userId, message: error.message });
    }
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error && user?.id === userId && user.email?.trim()) {
      console.info("[email:auth-resolve] tutorial_recipient", {
        userId,
        source: "server_getUser",
        hasEmail: true,
      });
      return user.email.trim();
    }
    if (error) {
      console.warn("[email:auth-resolve] getUser error", { userId, message: error.message });
    }
  } catch (e) {
    console.warn("[email:auth-resolve] getUser threw", {
      userId,
      message: e instanceof Error ? e.message : String(e),
    });
  }

  const fromSession = session.user.email?.trim() ?? null;
  if (fromSession) {
    console.info("[email:auth-resolve] tutorial_recipient", {
      userId,
      source: "session_jwt",
      hasEmail: true,
    });
  }
  return fromSession;
}

function welcomeRoleFromProfileRoles(roles: ProfileRole[]): "lister" | "cleaner" | "both" {
  if (roles.length === 0) return "both";
  if (roles.length >= 2) return "both";
  return roles[0] === "cleaner" ? "cleaner" : "lister";
}

/**
 * Sends the **welcome** email once after the user completes email verification (session established
 * in `/auth/confirm` or `/auth/callback`). Does **not** rely on `email_confirmed_at` in the JWT
 * (the caller is only invoked immediately after a successful verifyOtp / exchangeCodeForSession).
 *
 * Idempotent via `notification_preferences.email_welcome_sent` unless `force` (admin resend).
 */
export async function sendWelcomeEmailAfterEmailVerification(params: {
  userId: string;
  session: Session;
  /** Where this was triggered (logs, debugging). */
  trigger?: string;
  /** Admin “Resend welcome” — skips email_welcome_sent guard. */
  force?: boolean;
}): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  const trigger = params.trigger ?? "auth_session";
  logEmailEnvSnapshot(`welcome:${trigger}`);

  const email =
    params.session.user.email?.trim() ||
    (await (async () => {
      const admin = createSupabaseAdminClient();
      if (!admin) return null;
      const { data } = await admin.auth.admin.getUserById(params.userId);
      return data?.user?.email?.trim() ?? null;
    })());

  if (!email) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      trigger,
      reason: "no_email",
    });
    return { ok: false, skipped: "no_email" };
  }

  const globalSettings = await getGlobalSettings();
  if (globalSettings?.emails_enabled === false) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      trigger,
      reason: "global_emails_disabled",
    });
    return { ok: false, skipped: "global_emails_disabled" };
  }

  const prefs = await getNotificationPrefs(params.userId);
  if (prefs?.notificationPreferences?.email_welcome === false) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      trigger,
      reason: "user_pref_email_welcome_off",
    });
    return { ok: false, skipped: "user_pref_email_welcome_off" };
  }
  if (prefs?.emailForceDisabled) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      trigger,
      reason: "email_force_disabled",
    });
    return { ok: false, skipped: "email_force_disabled" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.warn("[email:welcome] no_service_role_admin — attempting send without prefs/idempotency", {
      userId: params.userId,
      trigger,
    });
    const { subject, html } = await buildWelcomeEmail(undefined, "both");
    const welcomeResult = await sendEmail(email, subject, html, {
      log: { userId: params.userId, kind: "welcome" },
    });
    if (!welcomeResult.ok) {
      return { ok: false, error: welcomeResult.error ?? "send_failed" };
    }
    const outcome = welcomeResult.skipped ? "skipped" : "sent";
    console.info("[email:welcome]", { outcome, userId: params.userId, trigger, note: "fallback_no_admin" });
    return welcomeResult.skipped ? { ok: false, skipped: "send_skipped" } : { ok: true };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("notification_preferences, full_name, roles, active_role")
    .eq("id", params.userId)
    .maybeSingle();

  const merged = prefsRecord(
    profile?.notification_preferences as Record<string, boolean | undefined> | null
  );
  if (merged[WELCOME_SENT_KEY] === true && !params.force) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      trigger,
      reason: "already_sent",
    });
    return { ok: false, skipped: "already_sent" };
  }

  const fullName = (profile as { full_name?: string | null } | null)?.full_name ?? null;
  const roles = normalizeProfileRolesFromDb(
    (profile as { roles?: unknown } | null)?.roles ?? null,
    !!profile
  );
  const signupRole = welcomeRoleFromProfileRoles(roles);
  const firstName = fullName?.trim()?.split(" ")[0];

  console.info("[email:welcome:attempt]", {
    userId: params.userId,
    trigger,
    force: Boolean(params.force),
    signupRole,
    to: email.replace(/(^.).*(@.*)$/, "$1***$2"),
  });
  console.info("[email:user-journey] welcome_attempt", {
    userId: params.userId,
    trigger,
    signupRole,
  });

  const { subject, html } = await buildWelcomeEmail(firstName, signupRole);
  const welcomeResult = await sendEmail(email, subject, html, {
    log: { userId: params.userId, kind: "welcome" },
  });

  if (welcomeResult.skipped) {
    console.info("[email:welcome]", {
      outcome: "skipped",
      userId: params.userId,
      trigger,
      reason: "send_skipped",
    });
    return { ok: false, skipped: "send_skipped" };
  }
  if (!welcomeResult.ok) {
    console.error("[email:welcome]", {
      outcome: "failed",
      userId: params.userId,
      trigger,
      error: welcomeResult.error ?? "unknown",
    });
    return { ok: false, error: welcomeResult.error ?? "unknown" };
  }

  merged[WELCOME_SENT_KEY] = true;
  await admin
    .from("profiles")
    .update({ notification_preferences: merged as never })
    .eq("id", params.userId);

  console.info("[email:welcome]", { outcome: "sent", userId: params.userId, trigger });
  console.info("[email:user-journey] welcome_sent", { userId: params.userId, trigger });
  return { ok: true };
}

/**
 * Role-specific tutorial emails (lister vs cleaner). Tracks
 * `email_tutorial_lister_sent` / `email_tutorial_cleaner_sent` in notification_preferences.
 *
 * Requires a recipient address (service_role lookup first). Does **not** gate on
 * `email_confirmed_at` — JWT may lag after confirm; logged-in users are eligible.
 */
export async function sendTutorialEmailsForRoles(params: {
  userId: string;
  session: Session;
  firstName: string | undefined;
  roles: TutorialRole[];
  /** @deprecated No longer used; kept for call-site compatibility. */
  skipEmailConfirmedCheck?: boolean;
}): Promise<void> {
  const email = await resolveRecipientEmailForTutorial(params.userId, params.session);

  if (!email) {
    console.info("[email:tutorial]", { outcome: "skipped", userId: params.userId, reason: "no_email" });
    console.info("[email:user-journey] tutorial_skipped", {
      userId: params.userId,
      reason: "no_email",
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
    const key = role === "lister" ? "email_tutorial_lister_sent" : "email_tutorial_cleaner_sent";
    if (merged[key] === true) continue;

    console.info("[email:tutorial:attempt]", {
      userId: params.userId,
      role,
      to: email.replace(/(^.).*(@.*)$/, "$1***$2"),
    });
    console.info("[email:user-journey] tutorial_attempt", {
      userId: params.userId,
      role,
      phase: "role_saved_onboarding",
    });

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

    merged[key] = true;
    merged.email_tutorial_sent = true;
    wrote = true;
    console.info("[email:tutorial]", { outcome: "sent", userId: params.userId, role });
    console.info("[email:user-journey] tutorial_sent", { userId: params.userId, role });
  }

  if (wrote) {
    await admin
      .from("profiles")
      .update({ notification_preferences: merged as never })
      .eq("id", params.userId);
  }
}

/**
 * After email verification: send role tutorial emails when we can resolve a role from
 * `profiles.roles` (Path 2) or from `user_metadata.pending_role` set at sign-up (Path 1).
 */
export async function sendTutorialEmailsAfterEmailVerificationIfNeeded(params: {
  userId: string;
  session: Session;
  trigger?: string;
}): Promise<void> {
  const trigger = params.trigger ?? "after_email_verify";
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.warn("[email:tutorial:after_verify] skipped_no_admin", { userId: params.userId });
    return;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, roles")
    .eq("id", params.userId)
    .maybeSingle();

  let roles = normalizeProfileRolesFromDb(
    (profile as { roles?: unknown } | null)?.roles ?? null,
    !!profile
  );

  if (roles.length === 0) {
    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(params.userId);
    if (!authErr && authData?.user?.user_metadata) {
      const fromMeta = tutorialRolesFromPendingMetadata(
        authData.user.user_metadata as Record<string, unknown>
      );
      if (fromMeta.length > 0) {
        roles = fromMeta;
        console.info("[email:tutorial:after_verify] roles_from_pending_metadata", {
          userId: params.userId,
          trigger,
          roles: fromMeta,
        });
      }
    }
  }

  if (roles.length === 0) {
    console.info("[email:tutorial:after_verify] skipped_no_roles", {
      userId: params.userId,
      trigger,
    });
    return;
  }

  const tutorialRoles = roles.filter((r): r is TutorialRole => r === "lister" || r === "cleaner");
  if (tutorialRoles.length === 0) return;

  const firstName = (profile as { full_name?: string | null } | null)?.full_name?.trim()?.split(" ")[0];

  console.info("[email:tutorial:after_verify] attempt", {
    userId: params.userId,
    trigger,
    roles: tutorialRoles,
  });

  await sendTutorialEmailsForRoles({
    userId: params.userId,
    session: params.session,
    firstName,
    roles: tutorialRoles,
  });
}
