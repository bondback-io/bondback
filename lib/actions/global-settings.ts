"use server";

import { revalidatePath } from "next/cache";
import { revalidateGlobalSettingsCache } from "@/lib/cache-revalidate";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PRICING_MODIFIERS } from "@/lib/pricing-modifiers";

/** When to send the email. instant = immediately; 5m, 1h, 1d etc. = delayed (requires worker); on_dob = on user's date of birth (birthday template only). */
export type SendAfterOption = "instant" | "5m" | "15m" | "30m" | "1h" | "2h" | "1d" | "2d" | "3d" | "5d" | "7d" | "10d" | "14d" | "21d" | "30d" | "60d" | "on_dob";

/** Admin email template override (subject + body HTML + active + send_after). */
export type EmailTemplateOverride = {
  subject: string;
  body: string;
  active: boolean;
  send_after?: string;
};

/** Local type for global_settings row (table may not be in generated types). */
type GlobalSettingsRow = {
  id: number;
  platform_fee_percentage?: number;
  fee_percentage?: number;
  require_abn?: boolean;
  min_profile_completion?: number;
  auto_release_hours?: number;
  emails_enabled?: boolean;
  require_stripe_connect_before_bidding?: boolean;
  announcement_text?: string | null;
  announcement_active?: boolean;
  maintenance_active?: boolean;
  maintenance_message?: string | null;
  referral_enabled?: boolean;
  referral_referrer_amount?: number;
  referral_referred_amount?: number;
  referral_min_job_amount?: number;
  referral_max_per_user_month?: number;
  referral_terms_text?: string | null;
  manual_payout_mode?: boolean;
  platform_abn?: string | null;
  send_payment_receipt_emails?: boolean;
  stripe_connect_enabled?: boolean;
  payout_schedule?: "daily" | "weekly" | "monthly";
  email_templates?: Record<string, EmailTemplateOverride>;
  email_type_enabled?: Record<string, boolean>;
  stripe_test_mode?: boolean;
  floating_chat_enabled?: boolean;
  /** When false, disables the scheduled daily digest email (user prefs still apply when true). */
  daily_digest_enabled?: boolean;
  /** When false, disables new-job SMS and push alerts (cleaner prefs apply when true). */
  enable_sms_alerts_new_jobs?: boolean;
  /** When false, no Twilio SMS is sent site-wide. */
  enable_sms_notifications?: boolean;
  /** Admin inbox alerts (Resend). */
  admin_notify_new_user?: boolean;
  admin_notify_new_listing?: boolean;
  admin_notify_dispute?: boolean;
  /** Per notification type for transactional SMS; empty {} = all allowed. */
  sms_type_enabled?: Record<string, boolean> | null;
  max_sms_per_user_per_day?: number | null;
  max_push_per_user_per_day?: number | null;
  /** AUD; default aligns with lib/pricing-modifiers legacy fit */
  pricing_base_rate_per_bedroom_aud?: number | null;
  /** Scales (rate × beds × condition × levels); default 1 */
  pricing_base_multiplier?: number | null;
  pricing_condition_excellent_very_good_pct?: number | null;
  pricing_condition_good_pct?: number | null;
  pricing_condition_fair_average_pct?: number | null;
  pricing_condition_poor_bad_pct?: number | null;
  pricing_levels_two_pct?: number | null;
  pricing_carpet_steam_per_bedroom_aud?: number | null;
  pricing_walls_per_bedroom_aud?: number | null;
  pricing_windows_per_bedroom_aud?: number | null;
  pricing_addon_oven_aud?: number | null;
  pricing_addon_balcony_aud?: number | null;
  pricing_addon_garage_aud?: number | null;
  pricing_addon_laundry_aud?: number | null;
  pricing_addon_patio_aud?: number | null;
  pricing_addon_fridge_aud?: number | null;
  pricing_addon_blinds_aud?: number | null;
  /** When true, new listings may use starting price below $100 (e.g. $1 tests). */
  allow_low_amount_listings?: boolean;
  /** When true, new listing form may offer a 2-minute auction (duration_days = 0 sentinel). */
  allow_two_minute_auction_test?: boolean;
  /** Default light/dark for guests and new signups. */
  default_site_theme?: string | null;
};

/** Normalize DB boolean (PostgREST returns boolean; guard edge cases). */
function normalizeRequireAbn(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

/**
 * PostgREST schema-cache / warm-up failures (PGRST002).
 * `code` is sometimes missing on the client; match message too.
 */
function isPostgrestSchemaCacheError(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code === "PGRST002") return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("schema cache") || m.includes("pgrst002");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Whether ABR lookup is required for ABN validation. Prefers service role so this matches
 * admin global_settings even when the caller has no session (anon cannot SELECT global_settings under RLS).
 */
export async function getRequireAbnForValidation(): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (admin) {
    let lastError: { message: string; code?: string } | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await delay(400);
      const { data, error } = await admin
        .from("global_settings")
        .select("require_abn")
        .eq("id", 1)
        .maybeSingle();
      if (!error && data != null) {
        return normalizeRequireAbn((data as { require_abn?: unknown }).require_abn);
      }
      if (error) {
        lastError = error;
        if (!isPostgrestSchemaCacheError(error) || attempt === 1) break;
      }
    }
    if (lastError && process.env.NODE_ENV !== "production") {
      if (!isPostgrestSchemaCacheError(lastError)) {
         
        console.error("[getRequireAbnForValidation] admin read failed", lastError);
      }
    }
  }
  const settings = await getGlobalSettings();
  if (settings != null) {
    return normalizeRequireAbn(settings.require_abn);
  }
  return false;
}

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profile || !(profile as { is_admin?: boolean }).is_admin) {
    throw new Error("Not authorised");
  }

  return supabase;
}

export async function getGlobalSettings(): Promise<GlobalSettingsRow | null> {
  // RLS only allows SELECT for admins on global_settings; use service role for public reads (fees, flags).
  const admin = createSupabaseAdminClient();
  let loggedSchemaCacheHint = false;
  if (admin) {
    let lastError: { message: string; code?: string; details?: string; hint?: string } | null =
      null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        await delay(400);
      }
      const { data, error } = await admin
        .from("global_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (!error) {
        return (data as GlobalSettingsRow | null) ?? null;
      }
      lastError = error;
      if (!isPostgrestSchemaCacheError(error) || attempt === 1) {
        break;
      }
    }
    if (lastError && process.env.NODE_ENV !== "production") {
      if (isPostgrestSchemaCacheError(lastError)) {
        loggedSchemaCacheHint = true;
         
        console.warn(
          "[getGlobalSettings] Supabase schema cache not ready (PGRST002); using fallbacks. Retry or check project is active."
        );
      } else {
         
        console.error(
          "[getGlobalSettings] admin read failed",
          lastError.message,
          lastError.code,
          lastError.details ?? lastError.hint
        );
      }
    }
  }

  const supabase = await createServerSupabaseClient();
  let sessionError: { message: string; code?: string; details?: string; hint?: string } | null =
    null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await delay(400);
    }
    const { data, error } = await supabase
      .from("global_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!error) {
      return (data as GlobalSettingsRow | null) ?? null;
    }
    sessionError = error;
    if (!isPostgrestSchemaCacheError(error) || attempt === 1) {
      break;
    }
  }
  if (sessionError && process.env.NODE_ENV !== "production") {
    if (isPostgrestSchemaCacheError(sessionError)) {
      if (!loggedSchemaCacheHint) {
         
        console.warn(
          "[getGlobalSettings] Supabase schema cache not ready (PGRST002); using fallbacks."
        );
      }
    } else {
       
      console.error(
        "[getGlobalSettings] session read failed (expected for non-admins without service role)",
        sessionError.message,
        sessionError.code,
        sessionError.details ?? sessionError.hint
      );
    }
  }
  return null;
}

/** Email template overrides and per-type enabled flags from email_template_overrides table (no global_settings columns). */
export async function getEmailTemplateOverrides(): Promise<{
  email_templates: Record<string, { subject: string; body: string; active: boolean }>;
  email_type_enabled: Record<string, boolean>;
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[getEmailTemplateOverrides] service role missing; returning empty overrides.");
    }
    return { email_templates: {}, email_type_enabled: {} };
  }
  const { data: rows, error } = await admin
    .from("email_template_overrides")
    .select("template_key, subject, body, active, type_enabled");
  if (error && process.env.NODE_ENV !== "production") {
    console.warn("[getEmailTemplateOverrides]", error.message);
  }
  const email_templates: Record<string, { subject: string; body: string; active: boolean }> = {};
  const email_type_enabled: Record<string, boolean> = {};
  (rows ?? []).forEach((r: { template_key: string; subject: string; body: string; active: boolean; type_enabled: boolean }) => {
    email_templates[r.template_key] = { subject: r.subject ?? "", body: r.body ?? "", active: !!r.active };
    email_type_enabled[r.template_key] = r.type_enabled !== false;
  });
  return { email_templates, email_type_enabled };
}

export type SaveGlobalSettingsInput = {
  feePercentage: number;
  requireAbn: boolean;
  requireStripeConnectBeforeBidding?: boolean;
  minProfileCompletion: number;
  autoReleaseHours: number;
  emailsEnabled: boolean;
  announcementText: string;
  announcementActive: boolean;
  maintenanceActive: boolean;
  maintenanceMessage: string;
  referralEnabled?: boolean;
  referralReferrerAmount?: number;
  referralReferredAmount?: number;
  referralMinJobAmount?: number;
  referralMaxPerUserMonth?: number;
  referralTermsText?: string;
  manualPayoutMode?: boolean;
  platformAbn?: string | null;
  sendPaymentReceiptEmails?: boolean;
  stripeConnectEnabled?: boolean;
  payoutSchedule?: "daily" | "weekly" | "monthly";
  stripeTestMode?: boolean;
  floatingChatEnabled?: boolean;
  enableSmsAlertsNewJobs?: boolean;
  /** Master Twilio SMS switch (transactional + new-job SMS). */
  enableSmsNotifications?: boolean;
  /** Keys match notification types / new_job_in_area for area alerts. */
  smsTypeEnabled?: Record<string, boolean>;
  maxSmsPerUserPerDay?: number | null;
  maxPushPerUserPerDay?: number | null;
  pricingBaseRatePerBedroomAud?: number;
  pricingBaseMultiplier?: number;
  pricingConditionExcellentVeryGoodPct?: number;
  pricingConditionGoodPct?: number;
  pricingConditionFairAveragePct?: number;
  pricingConditionPoorBadPct?: number;
  pricingLevelsTwoPct?: number;
  pricingCarpetSteamPerBedroomAud?: number;
  pricingWallsPerBedroomAud?: number;
  pricingWindowsPerBedroomAud?: number;
  pricingAddonOvenAud?: number;
  pricingAddonBalconyAud?: number;
  pricingAddonGarageAud?: number;
  pricingAddonLaundryAud?: number;
  pricingAddonPatioAud?: number;
  pricingAddonFridgeAud?: number;
  pricingAddonBlindsAud?: number;
  dailyDigestEnabled?: boolean;
  /** Admin email alerts (requires emails_enabled). */
  adminNotifyNewUser?: boolean;
  adminNotifyNewListing?: boolean;
  adminNotifyDispute?: boolean;
  /** When true, bypass $100 AUD minimum starting price for new listings. */
  allowLowAmountListings?: boolean;
  /** When true, show a 2-minute auction duration on the new listing form (testing). */
  allowTwoMinuteAuctionTest?: boolean;
  /** Default theme for logged-out users and new signups (`profiles.theme_preference`). */
  defaultSiteTheme?: "light" | "dark";
};

export type SaveGlobalSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveGlobalSettings(
  data: SaveGlobalSettingsInput
): Promise<SaveGlobalSettingsResult> {
  const supabase = await requireAdmin();
  const admin = createSupabaseAdminClient();

  const row: Record<string, unknown> = {
    id: 1,
    platform_fee_percentage: data.feePercentage,
    fee_percentage: data.feePercentage,
    require_abn: data.requireAbn,
    require_stripe_connect_before_bidding: data.requireStripeConnectBeforeBidding ?? true,
    min_profile_completion: data.minProfileCompletion,
    auto_release_hours: data.autoReleaseHours,
    emails_enabled: data.emailsEnabled,
    announcement_text: data.announcementText || null,
    announcement_active: data.announcementActive,
    maintenance_active: data.maintenanceActive,
    maintenance_message: data.maintenanceMessage || null,
    referral_enabled: data.referralEnabled ?? false,
    referral_referrer_amount: data.referralReferrerAmount ?? 20,
    referral_referred_amount: data.referralReferredAmount ?? 10,
    referral_min_job_amount: data.referralMinJobAmount ?? 100,
    referral_max_per_user_month: data.referralMaxPerUserMonth ?? 10,
    referral_terms_text: data.referralTermsText || null,
    manual_payout_mode: data.manualPayoutMode ?? false,
    platform_abn: data.platformAbn?.trim() || null,
    send_payment_receipt_emails: data.sendPaymentReceiptEmails ?? true,
    stripe_connect_enabled: data.stripeConnectEnabled ?? true,
    payout_schedule: data.payoutSchedule ?? "weekly",
    stripe_test_mode: typeof data.stripeTestMode === "boolean" ? data.stripeTestMode : true,
    floating_chat_enabled: typeof data.floatingChatEnabled === "boolean" ? data.floatingChatEnabled : true,
    enable_sms_alerts_new_jobs: typeof data.enableSmsAlertsNewJobs === "boolean" ? data.enableSmsAlertsNewJobs : true,
    enable_sms_notifications: data.enableSmsNotifications !== false,
    sms_type_enabled:
      data.smsTypeEnabled && typeof data.smsTypeEnabled === "object"
        ? data.smsTypeEnabled
        : {},
    max_sms_per_user_per_day: data.maxSmsPerUserPerDay ?? null,
    max_push_per_user_per_day: data.maxPushPerUserPerDay ?? null,
    pricing_base_rate_per_bedroom_aud:
      typeof data.pricingBaseRatePerBedroomAud === "number" && Number.isFinite(data.pricingBaseRatePerBedroomAud)
        ? Math.max(1, data.pricingBaseRatePerBedroomAud)
        : DEFAULT_PRICING_MODIFIERS.baseRatePerBedroomAud,
    pricing_base_multiplier:
      typeof data.pricingBaseMultiplier === "number" && Number.isFinite(data.pricingBaseMultiplier)
        ? Math.max(0.01, data.pricingBaseMultiplier)
        : DEFAULT_PRICING_MODIFIERS.baseMultiplier,
    pricing_condition_excellent_very_good_pct:
      typeof data.pricingConditionExcellentVeryGoodPct === "number" && Number.isFinite(data.pricingConditionExcellentVeryGoodPct)
        ? Math.max(0, data.pricingConditionExcellentVeryGoodPct)
        : 0,
    pricing_condition_good_pct:
      typeof data.pricingConditionGoodPct === "number" && Number.isFinite(data.pricingConditionGoodPct)
        ? Math.max(0, data.pricingConditionGoodPct)
        : 12,
    pricing_condition_fair_average_pct:
      typeof data.pricingConditionFairAveragePct === "number" && Number.isFinite(data.pricingConditionFairAveragePct)
        ? Math.max(0, data.pricingConditionFairAveragePct)
        : 25,
    pricing_condition_poor_bad_pct:
      typeof data.pricingConditionPoorBadPct === "number" && Number.isFinite(data.pricingConditionPoorBadPct)
        ? Math.max(0, data.pricingConditionPoorBadPct)
        : 40,
    pricing_levels_two_pct:
      typeof data.pricingLevelsTwoPct === "number" && Number.isFinite(data.pricingLevelsTwoPct)
        ? Math.max(0, data.pricingLevelsTwoPct)
        : 15,
    pricing_carpet_steam_per_bedroom_aud:
      typeof data.pricingCarpetSteamPerBedroomAud === "number" &&
      Number.isFinite(data.pricingCarpetSteamPerBedroomAud)
        ? Math.max(0, data.pricingCarpetSteamPerBedroomAud)
        : DEFAULT_PRICING_MODIFIERS.carpetSteamPerBedroomAud,
    pricing_walls_per_bedroom_aud:
      typeof data.pricingWallsPerBedroomAud === "number" && Number.isFinite(data.pricingWallsPerBedroomAud)
        ? Math.max(0, data.pricingWallsPerBedroomAud)
        : DEFAULT_PRICING_MODIFIERS.wallsPerBedroomAud,
    pricing_windows_per_bedroom_aud:
      typeof data.pricingWindowsPerBedroomAud === "number" && Number.isFinite(data.pricingWindowsPerBedroomAud)
        ? Math.max(0, data.pricingWindowsPerBedroomAud)
        : DEFAULT_PRICING_MODIFIERS.windowsPerBedroomAud,
    pricing_addon_oven_aud:
      typeof data.pricingAddonOvenAud === "number" && Number.isFinite(data.pricingAddonOvenAud)
        ? Math.max(0, data.pricingAddonOvenAud)
        : DEFAULT_PRICING_MODIFIERS.addonOvenAud,
    pricing_addon_balcony_aud:
      typeof data.pricingAddonBalconyAud === "number" && Number.isFinite(data.pricingAddonBalconyAud)
        ? Math.max(0, data.pricingAddonBalconyAud)
        : DEFAULT_PRICING_MODIFIERS.addonBalconyAud,
    pricing_addon_garage_aud:
      typeof data.pricingAddonGarageAud === "number" && Number.isFinite(data.pricingAddonGarageAud)
        ? Math.max(0, data.pricingAddonGarageAud)
        : DEFAULT_PRICING_MODIFIERS.addonGarageAud,
    pricing_addon_laundry_aud:
      typeof data.pricingAddonLaundryAud === "number" && Number.isFinite(data.pricingAddonLaundryAud)
        ? Math.max(0, data.pricingAddonLaundryAud)
        : DEFAULT_PRICING_MODIFIERS.addonLaundryAud,
    pricing_addon_patio_aud:
      typeof data.pricingAddonPatioAud === "number" && Number.isFinite(data.pricingAddonPatioAud)
        ? Math.max(0, data.pricingAddonPatioAud)
        : DEFAULT_PRICING_MODIFIERS.addonPatioAud,
    pricing_addon_fridge_aud:
      typeof data.pricingAddonFridgeAud === "number" && Number.isFinite(data.pricingAddonFridgeAud)
        ? Math.max(0, data.pricingAddonFridgeAud)
        : DEFAULT_PRICING_MODIFIERS.addonFridgeAud,
    pricing_addon_blinds_aud:
      typeof data.pricingAddonBlindsAud === "number" && Number.isFinite(data.pricingAddonBlindsAud)
        ? Math.max(0, data.pricingAddonBlindsAud)
        : DEFAULT_PRICING_MODIFIERS.addonBlindsAud,
    daily_digest_enabled: data.dailyDigestEnabled !== false,
    admin_notify_new_user: data.adminNotifyNewUser !== false,
    admin_notify_new_listing: data.adminNotifyNewListing !== false,
    admin_notify_dispute: data.adminNotifyDispute !== false,
    allow_low_amount_listings: data.allowLowAmountListings === true,
    allow_two_minute_auction_test: data.allowTwoMinuteAuctionTest === true,
    default_site_theme: data.defaultSiteTheme === "light" ? "light" : "dark",
  };

  const { error } = admin
    ? await admin.from("global_settings").upsert(row as never, { onConflict: "id" })
    : await supabase.from("global_settings").upsert(row as never, { onConflict: "id" });

  if (error) {
    const msg = error.message;
    const hint =
      msg.includes("does not exist") || msg.includes("42703")
        ? msg.includes("default_site_theme")
          ? " Add column global_settings.default_site_theme (see sql/20260216120000_global_settings_default_site_theme.sql)."
          : " Run the migration: supabase/migrations/20250308120000_global_settings.sql (or create the global_settings table with announcement_text, announcement_active, etc.)."
        : "";
    return { ok: false, error: msg + hint };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const adminId = session?.user?.id ?? null;
  const { logAdminActivity } = await import("@/lib/admin-activity-log");
  await logAdminActivity({
    adminId,
    actionType: "global_settings_updated",
    targetType: "other",
    targetId: null,
    details: {
      fee_percentage: data.feePercentage,
      require_abn: data.requireAbn,
      emails_enabled: data.emailsEnabled,
      maintenance_active: data.maintenanceActive,
      allow_low_amount_listings: data.allowLowAmountListings === true,
      allow_two_minute_auction_test: data.allowTwoMinuteAuctionTest === true,
      default_site_theme: data.defaultSiteTheme === "light" ? "light" : "dark",
    },
  });

  revalidatePath("/admin/global-settings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/emails");
  revalidatePath("/");
  revalidatePath("/", "layout");
  revalidatePath("/listings/new");
  revalidateGlobalSettingsCache();

  // Clear Stripe config/server cache so next request uses the new test/live mode
  const { clearStripeConfigCache } = await import("@/lib/stripe/config");
  const { clearStripeServerCache } = await import("@/lib/stripe");
  clearStripeConfigCache();
  clearStripeServerCache();

  return { ok: true };
}

export type SetFloatingChatEnabledResult =
  | { ok: true; floatingChatEnabled: boolean }
  | { ok: false; error: string };

/**
 * Update only floating chat visibility (header icon + floating panel).
 * Uses upsert (not bare update) so id=1 always gets a row — plain UPDATE can match 0 rows with no error.
 */
export async function setFloatingChatEnabled(
  enabled: boolean
): Promise<SetFloatingChatEnabledResult> {
  const supabase = await requireAdmin();
  const admin = createSupabaseAdminClient();

  const nowIso = new Date().toISOString();
  const row = {
    id: 1,
    floating_chat_enabled: enabled,
    updated_at: nowIso,
  };

  const { data: upserted, error } = admin
    ? await admin
        .from("global_settings")
        .upsert(row as never, { onConflict: "id" })
        .select("floating_chat_enabled")
        .maybeSingle()
    : await supabase
        .from("global_settings")
        .upsert(row as never, { onConflict: "id" })
        .select("floating_chat_enabled")
        .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  const savedRaw = (upserted as { floating_chat_enabled?: unknown } | null)?.floating_chat_enabled;
  const saved =
    savedRaw === false || savedRaw === "false" || savedRaw === 0 ? false : true;

  const { data: { session } } = await supabase.auth.getSession();
  const { logAdminActivity } = await import("@/lib/admin-activity-log");
  await logAdminActivity({
    adminId: session?.user?.id ?? null,
    actionType: "floating_chat_toggled",
    targetType: "other",
    targetId: null,
    details: { floating_chat_enabled: saved },
  });

  revalidatePath("/admin/global-settings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/", "layout");
  revalidateGlobalSettingsCache();

  return { ok: true, floatingChatEnabled: saved };
}

export type SetStripeTestModeResult =
  | { ok: true }
  | { ok: false; error: string };

/** Update only Stripe test mode. Saves immediately; clears Stripe config cache. */
export async function setStripeTestMode(
  enabled: boolean
): Promise<SetStripeTestModeResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("global_settings")
    .update({ stripe_test_mode: enabled } as never)
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  const { data: { session } } = await supabase.auth.getSession();
  const { logAdminActivity } = await import("@/lib/admin-activity-log");
  await logAdminActivity({
    adminId: session?.user?.id ?? null,
    actionType: "stripe_test_mode_toggled",
    targetType: "other",
    targetId: null,
    details: { stripe_test_mode: enabled },
  });
  revalidatePath("/admin/global-settings");
  revalidatePath("/");
  revalidatePath("/", "layout");
  revalidateGlobalSettingsCache();
  const { clearStripeConfigCache } = await import("@/lib/stripe/config");
  const { clearStripeServerCache } = await import("@/lib/stripe");
  clearStripeConfigCache();
  clearStripeServerCache();
  return { ok: true };
}

export type SetEmailsEnabledResult =
  | { ok: true }
  | { ok: false; error: string };

/** Update only the global emails kill switch (e.g. from admin email templates page). */
export async function setEmailsEnabled(
  enabled: boolean
): Promise<SetEmailsEnabledResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("global_settings")
    .update({
      emails_enabled: enabled,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  const { data: { session } } = await supabase.auth.getSession();
  const { logAdminActivity } = await import("@/lib/admin-activity-log");
  await logAdminActivity({ adminId: session?.user?.id ?? null, actionType: "emails_enabled_toggled", targetType: "other", targetId: null, details: { enabled } });
  revalidatePath("/admin/emails");
  revalidatePath("/admin/global-settings");
  revalidateGlobalSettingsCache();
  return { ok: true };
}

