"use server";

import type { Session } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  getEmailForUserId,
  getNotificationPrefs,
} from "@/lib/supabase/admin";
import { shouldSendEmailForType } from "@/lib/notification-preferences";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import {
  buildLaunchPromoEndingSoonEmail,
  buildLaunchPromoProgressEmail,
  buildLaunchPromoWelcomeEmail,
  sendEmail,
} from "@/lib/notifications/email";
import {
  isLaunchPromoWindowOpen,
  launchPromoFreeJobSlots,
  type GlobalSettingsWithLaunchPromo,
} from "@/lib/launch-promo";
import { createNotification } from "@/lib/actions/notifications";
import { normalizeProfileRolesFromDb } from "@/lib/profile-roles";
import type { ProfileRole } from "@/lib/types";

const EMAIL_PROMO_WELCOME = "email_launch_promo_welcome_sent" as const;
const EMAIL_PROGRESS = "email_launch_promo_progress_sent" as const;
const EMAIL_PROGRESS_CLEANER = "email_launch_promo_progress_cleaner_sent" as const;
const EMAIL_ENDING_SOON = "email_launch_promo_ending_soon_sent" as const;
const IN_APP_FIRST_LISTING = "in_app_launch_promo_first_listing_sent" as const;
const IN_APP_PROGRESS = "in_app_launch_promo_progress_sent" as const;
const IN_APP_PROGRESS_CLEANER = "in_app_launch_promo_progress_cleaner_sent" as const;
const IN_APP_ENDED = "in_app_launch_promo_ended_sent" as const;
const IN_APP_ENDED_CLEANER = "in_app_launch_promo_ended_cleaner_sent" as const;

const ENDING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

function prefsRecord(prefs: Record<string, boolean | undefined> | null | undefined) {
  return { ...(prefs ?? {}) } as Record<string, boolean | undefined>;
}

function normalFeePercent(gs: Awaited<ReturnType<typeof getGlobalSettings>>): number {
  const n = gs?.fee_percentage ?? gs?.platform_fee_percentage;
  return typeof n === "number" && Number.isFinite(n) ? n : 12;
}

function launchPromoMarketingOn(settings: GlobalSettingsWithLaunchPromo | null, now: Date): boolean {
  if (!settings || settings.launch_promo_active === false) return false;
  return isLaunchPromoWindowOpen(settings, now);
}

function promoEndsWithinWindow(settings: GlobalSettingsWithLaunchPromo | null, now: Date): boolean {
  const raw = settings?.launch_promo_ends_at;
  if (raw == null || String(raw).trim() === "") return false;
  const end = new Date(raw);
  if (!Number.isFinite(end.getTime())) return false;
  const msLeft = end.getTime() - now.getTime();
  return msLeft > 0 && msLeft <= ENDING_SOON_MS;
}

function welcomeRoleFromProfileRoles(roles: ProfileRole[]): "lister" | "cleaner" | "both" {
  if (roles.length === 0) return "both";
  if (roles.length >= 2) return "both";
  return roles[0] === "cleaner" ? "cleaner" : "lister";
}

function listerProgressInAppCopy(used: number, freeSlots: number): string {
  const slots = Math.max(1, freeSlots);
  const u = Math.min(used, slots);
  const left = Math.max(0, slots - u);
  if (slots === 2 && u === 1 && left === 1) {
    return "1 of 2 free jobs used. One more job with 0% fee!";
  }
  if (left === 1) {
    return `${u} of ${slots} free jobs used. One more job with 0% fee!`;
  }
  return `${u} of ${slots} free jobs used. You have ${left} free jobs with 0% fee remaining.`;
}

/**
 * When the promo end date is within 7 days, nudge listers who still have free slots (even if 0 jobs completed).
 */
async function maybeSendLaunchPromoEndingSoonEmailForExpiryOnly(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const now = new Date();
  const settings = await getGlobalSettings();
  if (!launchPromoMarketingOn(settings, now)) return;
  if (!promoEndsWithinWindow(settings, now)) return;
  if (settings?.emails_enabled === false) return;

  const freeSlots = launchPromoFreeJobSlots(settings);
  const feePct = normalFeePercent(settings);

  const { data: profile } = await admin
    .from("profiles")
    .select("notification_preferences, full_name, launch_promo_lister_jobs_used")
    .eq("id", userId)
    .maybeSingle();

  const usedRaw = (profile as { launch_promo_lister_jobs_used?: number | null } | null)
    ?.launch_promo_lister_jobs_used;
  const used =
    typeof usedRaw === "number" && Number.isFinite(usedRaw) && usedRaw >= 0
      ? Math.floor(usedRaw)
      : 0;
  if (used >= freeSlots) return;

  const merged = prefsRecord(
    profile?.notification_preferences as Record<string, boolean | undefined> | null
  );
  if (merged[EMAIL_ENDING_SOON] === true) return;

  const notify = await getNotificationPrefs(userId);
  const allowEmail =
    notify &&
    shouldSendEmailForType(
      notify.notificationPreferences,
      "payment_released",
      notify.emailForceDisabled
    );
  if (!allowEmail) return;

  const addr = (await getEmailForUserId(userId))?.trim() || null;
  if (!addr) return;

  const firstName = (profile as { full_name?: string | null } | null)?.full_name?.trim()?.split(" ")[0];
  const remaining = Math.max(0, freeSlots - used);
  const { subject, html } = await buildLaunchPromoEndingSoonEmail({
    firstName,
    freeJobSlotsRemaining: remaining,
    promoEndsAtIso: settings?.launch_promo_ends_at ?? null,
    normalFeePercent: feePct,
  });
  const r = await sendEmail(addr, subject, html, {
    log: { userId, kind: "launch_promo_ending_soon" },
  });
  if (!r.ok || r.skipped) return;

  merged[EMAIL_ENDING_SOON] = true;
  await admin
    .from("profiles")
    .update({ notification_preferences: merged as never })
    .eq("id", userId);
}

/**
 * Idempotent launch promo welcome (separate from core welcome email). Runs after the welcome flow.
 */
export async function sendLaunchPromoWelcomeEmailIfNeeded(params: {
  userId: string;
  session: Session;
  trigger?: string;
}): Promise<void> {
  const trigger = params.trigger ?? "auth_session";
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const now = new Date();
  const globalSettings = await getGlobalSettings();

  try {
    if (!launchPromoMarketingOn(globalSettings, now)) return;
    if (globalSettings?.emails_enabled === false) return;

    const email =
      params.session.user.email?.trim() || (await getEmailForUserId(params.userId))?.trim() || null;
    if (!email) return;

    const prefs = await getNotificationPrefs(params.userId);
    if (prefs?.notificationPreferences?.email_welcome === false) return;
    if (prefs?.emailForceDisabled) return;

    const { data: profile } = await admin
      .from("profiles")
      .select("notification_preferences, full_name, roles")
      .eq("id", params.userId)
      .maybeSingle();

    const merged = prefsRecord(
      profile?.notification_preferences as Record<string, boolean | undefined> | null
    );
    if (merged[EMAIL_PROMO_WELCOME] === true) return;

    const roles = normalizeProfileRolesFromDb(
      (profile as { roles?: unknown } | null)?.roles ?? null,
      !!profile
    );
    const signupRole = welcomeRoleFromProfileRoles(roles);
    const firstName = (profile as { full_name?: string | null } | null)?.full_name
      ?.trim()
      ?.split(" ")[0];

    const freeSlots = launchPromoFreeJobSlots(globalSettings);
    const { subject, html } = await buildLaunchPromoWelcomeEmail(firstName, signupRole, freeSlots);
    const result = await sendEmail(email, subject, html, {
      log: { userId: params.userId, kind: "launch_promo_welcome" },
    });
    if (!result.ok || result.skipped) return;

    merged[EMAIL_PROMO_WELCOME] = true;
    await admin
      .from("profiles")
      .update({ notification_preferences: merged as never })
      .eq("id", params.userId);

    console.info("[email:launch_promo_welcome]", { outcome: "sent", userId: params.userId, trigger });
  } finally {
    if (launchPromoMarketingOn(globalSettings, new Date())) {
      try {
        await maybeSendLaunchPromoEndingSoonEmailForExpiryOnly(params.userId);
      } catch (e) {
        console.warn("[email:launch_promo_ending_soon:expiry_hook] failed", {
          userId: params.userId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }
}

/**
 * First listing created while promo is on — in-app only.
 */
export async function notifyLaunchPromoInAppFirstListingIfNeeded(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const now = new Date();
  const settings = await getGlobalSettings();
  if (!launchPromoMarketingOn(settings, now)) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("notification_preferences")
    .eq("id", userId)
    .maybeSingle();

  const merged = prefsRecord(
    profile?.notification_preferences as Record<string, boolean | undefined> | null
  );
  if (merged[IN_APP_FIRST_LISTING] === true) return;

  const freeSlots = launchPromoFreeJobSlots(settings);
  const msg = `🎉 Your 0% Fee Promo is Active! You have ${freeSlots} free jobs remaining.`;

  const ok = await createNotification(userId, "launch_promo_active", null, msg, {
    channelDelivery: { email: false, inApp: true, sms: false, push: false },
  });
  if (!ok) return;

  merged[IN_APP_FIRST_LISTING] = true;
  await admin
    .from("profiles")
    .update({ notification_preferences: merged as never })
    .eq("id", userId);

  try {
    await maybeSendLaunchPromoEndingSoonEmailForExpiryOnly(userId);
  } catch (e) {
    console.warn("[email:launch_promo_ending_soon:expiry_hook] failed", {
      userId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * After escrow release consumed a launch promo slot (0% fee with positive base fee).
 */
export async function handleLaunchPromoAfterFeeWaivedCompletion(params: {
  jobId: number;
  listerId: string;
  winnerId: string | null;
  listerUsedAfter: number;
  cleanerUsedAfter: number | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const now = new Date();
  const settings = await getGlobalSettings();
  if (!launchPromoMarketingOn(settings, now)) return;

  const freeSlots = launchPromoFreeJobSlots(settings);
  const feePct = normalFeePercent(settings);

  const { data: listerProfile } = await admin
    .from("profiles")
    .select("notification_preferences, full_name")
    .eq("id", params.listerId)
    .maybeSingle();

  const listerPrefs = prefsRecord(
    listerProfile?.notification_preferences as Record<string, boolean | undefined> | null
  );
  const listerFirst = (listerProfile as { full_name?: string | null } | null)?.full_name
    ?.trim()
    ?.split(" ")[0];

  const listerNotify = await getNotificationPrefs(params.listerId);
  let listerDirty = false;

  if (params.listerUsedAfter === 1 && !listerPrefs[EMAIL_PROGRESS]) {
    const allowEmail =
      listerNotify &&
      shouldSendEmailForType(
        listerNotify.notificationPreferences,
        "payment_released",
        listerNotify.emailForceDisabled
      );
    if (allowEmail) {
      const addr = await getEmailForUserId(params.listerId);
      if (addr) {
        const { subject, html } = await buildLaunchPromoProgressEmail({
          firstName: listerFirst,
          role: "lister",
          completedCount: params.listerUsedAfter,
          freeJobSlots: freeSlots,
        });
        const r = await sendEmail(addr, subject, html, {
          log: { userId: params.listerId, kind: "launch_promo_progress" },
        });
        if (r.ok && !r.skipped) {
          listerPrefs[EMAIL_PROGRESS] = true;
          listerDirty = true;
        }
      }
    }
  }

  if (params.listerUsedAfter === 1 && !listerPrefs[IN_APP_PROGRESS]) {
    const msg = listerProgressInAppCopy(params.listerUsedAfter, freeSlots);
    const ok = await createNotification(params.listerId, "launch_promo_progress", params.jobId, msg, {
      channelDelivery: { email: false, inApp: true, sms: false, push: false },
    });
    if (ok) {
      listerPrefs[IN_APP_PROGRESS] = true;
      listerDirty = true;
    }
  }

  const remainingLister = freeSlots - params.listerUsedAfter;
  const endingSoonEligible =
    params.listerUsedAfter < freeSlots &&
    (remainingLister === 1 || promoEndsWithinWindow(settings, now));

  if (endingSoonEligible && !listerPrefs[EMAIL_ENDING_SOON]) {
    const allowEmail =
      listerNotify &&
      shouldSendEmailForType(
        listerNotify.notificationPreferences,
        "payment_released",
        listerNotify.emailForceDisabled
      );
    if (allowEmail) {
      const addr = await getEmailForUserId(params.listerId);
      if (addr) {
        const { subject, html } = await buildLaunchPromoEndingSoonEmail({
          firstName: listerFirst,
          freeJobSlotsRemaining: Math.max(0, remainingLister),
          promoEndsAtIso: settings?.launch_promo_ends_at ?? null,
          normalFeePercent: feePct,
        });
        const r = await sendEmail(addr, subject, html, {
          log: { userId: params.listerId, kind: "launch_promo_ending_soon" },
        });
        if (r.ok && !r.skipped) {
          listerPrefs[EMAIL_ENDING_SOON] = true;
          listerDirty = true;
        }
      }
    }
  }

  if (params.listerUsedAfter >= freeSlots && !listerPrefs[IN_APP_ENDED]) {
    const msg = `Your launch promo has ended. Normal ${feePct}% fee now applies.`;
    const ok = await createNotification(params.listerId, "launch_promo_ended", params.jobId, msg, {
      channelDelivery: { email: false, inApp: true, sms: false, push: false },
    });
    if (ok) {
      listerPrefs[IN_APP_ENDED] = true;
      listerDirty = true;
    }
  }

  if (listerDirty) {
    await admin
      .from("profiles")
      .update({ notification_preferences: listerPrefs as never })
      .eq("id", params.listerId);
  }

  const w = params.winnerId != null ? String(params.winnerId).trim() : "";
  if (!w || params.cleanerUsedAfter == null) return;

  const { data: cleanerProfile } = await admin
    .from("profiles")
    .select("notification_preferences, full_name")
    .eq("id", w)
    .maybeSingle();

  const cleanerPrefs = prefsRecord(
    cleanerProfile?.notification_preferences as Record<string, boolean | undefined> | null
  );
  const cleanerFirst = (cleanerProfile as { full_name?: string | null } | null)?.full_name
    ?.trim()
    ?.split(" ")[0];

  const cleanerNotify = await getNotificationPrefs(w);
  let cleanerDirty = false;

  if (params.cleanerUsedAfter === 1 && !cleanerPrefs[EMAIL_PROGRESS_CLEANER]) {
    const allowEmail =
      cleanerNotify &&
      shouldSendEmailForType(
        cleanerNotify.notificationPreferences,
        "payment_released",
        cleanerNotify.emailForceDisabled
      );
    if (allowEmail) {
      const addr = await getEmailForUserId(w);
      if (addr) {
        const { subject, html } = await buildLaunchPromoProgressEmail({
          firstName: cleanerFirst,
          role: "cleaner",
          completedCount: params.cleanerUsedAfter,
          freeJobSlots: freeSlots,
        });
        const r = await sendEmail(addr, subject, html, {
          log: { userId: w, kind: "launch_promo_progress_cleaner" },
        });
        if (r.ok && !r.skipped) {
          cleanerPrefs[EMAIL_PROGRESS_CLEANER] = true;
          cleanerDirty = true;
        }
      }
    }
  }

  if (params.cleanerUsedAfter === 1 && !cleanerPrefs[IN_APP_PROGRESS_CLEANER]) {
    const msg = listerProgressInAppCopy(params.cleanerUsedAfter, freeSlots);
    const ok = await createNotification(w, "launch_promo_progress", params.jobId, msg, {
      channelDelivery: { email: false, inApp: true, sms: false, push: false },
    });
    if (ok) {
      cleanerPrefs[IN_APP_PROGRESS_CLEANER] = true;
      cleanerDirty = true;
    }
  }

  if (params.cleanerUsedAfter >= freeSlots && !cleanerPrefs[IN_APP_ENDED_CLEANER]) {
    const msg = `Your launch promo has ended. Normal ${feePct}% fee now applies.`;
    const ok = await createNotification(w, "launch_promo_ended", params.jobId, msg, {
      channelDelivery: { email: false, inApp: true, sms: false, push: false },
    });
    if (ok) {
      cleanerPrefs[IN_APP_ENDED_CLEANER] = true;
      cleanerDirty = true;
    }
  }

  if (cleanerDirty) {
    await admin
      .from("profiles")
      .update({ notification_preferences: cleanerPrefs as never })
      .eq("id", w);
  }
}
