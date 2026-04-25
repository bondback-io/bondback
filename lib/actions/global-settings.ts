"use server";

import { revalidatePath } from "next/cache";
import { revalidateGlobalSettingsCache } from "@/lib/cache-revalidate";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, getEmailForUserId } from "@/lib/supabase/admin";
import { DEFAULT_PRICING_MODIFIERS } from "@/lib/pricing-modifiers";
import { DEFAULT_RESEND_FROM } from "@/lib/email-default-from";
import { SERVICE_TYPES, type ServiceTypeKey } from "@/lib/service-types";
import {
  SERVICE_ADDON_CHECKLIST_CUSTOM_TYPES,
  mergeServiceAddonsChecklists,
  serializeServiceAddonsChecklistsForDb,
  type ServiceAddonChecklistCustomType,
  type ServiceAddonsChecklistsMerged,
  type ServicePricedAddon,
} from "@/lib/service-addons-checklists";

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
  platform_fee_percentage_by_service_type?: unknown;
  require_abn?: boolean;
  min_profile_completion?: number;
  auto_release_hours?: number;
  emails_enabled?: boolean;
  require_stripe_connect_before_bidding?: boolean;
  /** When true (default), escrow release requires the winning cleaner to have completed Stripe Connect. */
  require_stripe_connect_before_payment_release?: boolean;
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
  /** Legacy column; digest feature removed — always saved false. */
  daily_digest_enabled?: boolean;
  /** When false, disables new-job SMS and push alerts (cleaner prefs apply when true). */
  enable_sms_alerts_new_jobs?: boolean;
  /** Extra radius buffer for "just outside preferred area" cleaner notifications. */
  additional_notification_radius_buffer_km?: number | null;
  /** Interval between no-bid listing reminder sends to cleaners. */
  new_listing_reminder_interval_hours?: number | null;
  /** Master toggle for scheduled no-bid listing reminder notifications. */
  enable_new_listing_reminders?: boolean | null;
  /** Default checklist labels used when a job checklist is first created. */
  default_cleaner_checklist_items?: string[] | null;
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
  /** Optional { bond_cleaning: n, ... }; missing keys use pricing_base_rate_per_bedroom_aud */
  pricing_base_rate_per_bedroom_by_service_type?: unknown;
  /** Scales (rate × beds × condition × levels); default 1 */
  pricing_base_multiplier?: number | null;
  /** Optional per-service multipliers; missing keys use pricing_base_multiplier */
  pricing_base_multiplier_by_service_type?: unknown;
  /** Optional { bond_cleaning: n, ... } AUD per bathroom; empty uses code defaults per service */
  pricing_bathroom_rate_per_bathroom_by_service_type?: unknown;
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
  /** Cleaner new listing #1 (within preferred km). Requires sql/20260417100000_global_settings_new_listing_channel_toggles.sql */
  new_listing_in_radius_email?: boolean;
  new_listing_in_radius_in_app?: boolean;
  new_listing_in_radius_sms?: boolean;
  new_listing_in_radius_push?: boolean;
  /** Cleaner new listing #2 (buffer / browse jobs). */
  new_listing_outside_email?: boolean;
  new_listing_outside_in_app?: boolean;
  new_listing_outside_sms?: boolean;
  new_listing_outside_push?: boolean;
  enable_daily_browse_jobs_nudge?: boolean | null;
  /** Non-bond services: priced add-ons + free checklist labels (see lib/service-addons-checklists.ts). */
  service_addons_checklists?: unknown;
  /**
   * 0 = no cleaner inactivity wait. 1–7 = that many full days of no activity before the lister can use non-responsive escrow cancel.
   */
  lister_nonresponsive_cancel_idle_days?: number | null;
};

/** Normalize DB boolean (PostgREST returns boolean; guard edge cases). */
function normalizeRequireAbn(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

function sanitizePlatformFeeByServiceTypeForDb(
  input: Partial<Record<string, number>> | null | undefined
): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, number> = {};
  for (const k of SERVICE_TYPES) {
    const v = input[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) {
      out[k] = Math.round(v * 100) / 100;
    }
  }
  return out;
}

function sanitizePricingBaseRateByServiceForDb(
  input: Partial<Record<ServiceTypeKey, number>> | null | undefined
): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, number> = {};
  for (const k of SERVICE_TYPES) {
    const v = input[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 1) {
      out[k] = Math.min(99999, Math.max(1, Math.round(v * 100) / 100));
    }
  }
  return out;
}

function sanitizePricingBaseMultiplierByServiceForDb(
  input: Partial<Record<ServiceTypeKey, number>> | null | undefined
): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, number> = {};
  for (const k of SERVICE_TYPES) {
    const v = input[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0.01) {
      out[k] = Math.min(1000, Math.max(0.01, Math.round(v * 10000) / 10000));
    }
  }
  return out;
}

/** Clamp 0–7; default 5 (legacy five-day idle). */
export function normalizeListerNonresponsiveCancelIdleDays(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(7, Math.floor(raw)));
  }
  return 5;
}

function sanitizePricingBathroomRateByServiceForDb(
  input: Partial<Record<ServiceTypeKey, number>> | null | undefined
): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, number> = {};
  for (const k of SERVICE_TYPES) {
    const v = input[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[k] = Math.min(99999, Math.max(0, Math.round(v * 100) / 100));
    }
  }
  return out;
}

const PRICED_ADDON_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/**
 * Normalize admin POST body into a DB-safe JSON blob; drops unknown keys and clamps sizes.
 */
function sanitizeServiceAddonsChecklistsForDb(
  input: ServiceAddonsChecklistsMerged | null | undefined
): Record<string, unknown> {
  const out = mergeServiceAddonsChecklists(null);
  if (!input || typeof input !== "object") {
    return serializeServiceAddonsChecklistsForDb(out);
  }

  for (const svc of SERVICE_ADDON_CHECKLIST_CUSTOM_TYPES) {
    const block = (input as Record<string, unknown>)[svc];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const b = block as { priced?: unknown; free?: unknown };
    const pricedIn = Array.isArray(b.priced) ? b.priced : [];
    const pricedOut: ServicePricedAddon[] = [];
    const seen = new Set<string>();
    for (const row of pricedIn) {
      if (pricedOut.length >= 24) break;
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const o = row as Record<string, unknown>;
      let id = String(o.id ?? "").trim().slice(0, 64);
      const name = String(o.name ?? "").trim().slice(0, 200);
      const priceRaw = o.priceAud ?? o.price_aud;
      const n =
        typeof priceRaw === "number" && Number.isFinite(priceRaw)
          ? priceRaw
          : typeof priceRaw === "string" && priceRaw.trim() !== ""
            ? Number(priceRaw)
            : NaN;
      if (!name || !Number.isFinite(n)) continue;
      if (!id || !PRICED_ADDON_ID_RE.test(id) || seen.has(id)) {
        id = `addon_${svc.slice(0, 6)}_${pricedOut.length}_${Math.random().toString(36).slice(2, 9)}`;
      }
      seen.add(id);
      pricedOut.push({
        id,
        name,
        priceAud: Math.max(0, Math.min(99999, Math.round(n))),
      });
    }
    const freeIn = Array.isArray(b.free) ? b.free : [];
    const freeOut = freeIn
      .map((v) => String(v ?? "").trim().slice(0, 300))
      .filter((v) => v.length > 0)
      .slice(0, 32);
    out[svc as ServiceAddonChecklistCustomType] = { priced: pricedOut, free: freeOut };
  }

  return serializeServiceAddonsChecklistsForDb(out);
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

/** Admin-editable template overrides were removed; transactional email uses built-in templates only. */
export async function getEmailTemplateOverrides(): Promise<{
  email_templates: Record<string, { subject: string; body: string; active: boolean }>;
  email_type_enabled: Record<string, boolean>;
}> {
  return { email_templates: {}, email_type_enabled: {} };
}

export type SaveGlobalSettingsInput = {
  feePercentage: number;
  /**
   * Optional Service Fee % per `listings.service_type`. Only keys 0–100 are stored;
   * omitted service types use `feePercentage`.
   */
  platformFeePercentageByServiceType?: Partial<Record<string, number>> | null;
  requireAbn: boolean;
  requireStripeConnectBeforeBidding?: boolean;
  /** Default ON: block releasing escrow until cleaner finishes Connect onboarding. */
  requireStripeConnectBeforePaymentRelease?: boolean;
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
  additionalNotificationRadiusBufferKm?: number;
  newListingReminderIntervalHours?: number;
  enableNewListingReminders?: boolean;
  defaultCleanerChecklistItems?: string[];
  maxSmsPerUserPerDay?: number | null;
  maxPushPerUserPerDay?: number | null;
  pricingBaseRatePerBedroomAud?: number;
  /** Per `listings.service_type` (AUD/bedroom). Omitted keys use `pricingBaseRatePerBedroomAud` when quoting. */
  pricingBaseRatePerBedroomByServiceType?: Partial<Record<ServiceTypeKey, number>> | null;
  pricingBaseMultiplier?: number;
  /** Per service type; omitted keys use `pricingBaseMultiplier`. */
  pricingBaseMultiplierByServiceType?: Partial<Record<ServiceTypeKey, number>> | null;
  /** Per service type AUD per bathroom (additive on new listing estimate). */
  pricingBathroomRatePerBathroomByServiceType?: Partial<Record<ServiceTypeKey, number>> | null;
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
  /** Notification #1 — within preferred travel radius (per channel). */
  newListingInRadiusEmail?: boolean;
  newListingInRadiusInApp?: boolean;
  newListingInRadiusSms?: boolean;
  newListingInRadiusPush?: boolean;
  /** Notification #2 — buffer ring / browse Jobs (per channel). */
  newListingOutsideEmail?: boolean;
  newListingOutsideInApp?: boolean;
  newListingOutsideSms?: boolean;
  newListingOutsidePush?: boolean;
  /** Scheduled daily browse-jobs nudge (uses #2 channel toggles). */
  enableDailyBrowseJobsNudge?: boolean;
  /**
   * Airbnb / recurring / deep: priced add-ons (quote) and free checklist lines.
   * Bond cleaning ignores this (legacy pricing + default checklist card).
   */
  serviceAddonsChecklists?: ServiceAddonsChecklistsMerged | null;
  /**
   * 0–7 full days of cleaner inactivity before non-responsive escrow cancel; 0 = no inactivity wait (idle check off).
   */
  listerNonresponsiveCancelIdleDays?: number;
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
    platform_fee_percentage_by_service_type: sanitizePlatformFeeByServiceTypeForDb(
      data.platformFeePercentageByServiceType
    ),
    require_abn: data.requireAbn,
    require_stripe_connect_before_bidding: data.requireStripeConnectBeforeBidding ?? false,
    require_stripe_connect_before_payment_release: data.requireStripeConnectBeforePaymentRelease !== false,
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
    enable_sms_alerts_new_jobs:
      typeof data.newListingInRadiusSms === "boolean" && typeof data.newListingOutsideSms === "boolean"
        ? data.newListingInRadiusSms !== false || data.newListingOutsideSms !== false
        : typeof data.enableSmsAlertsNewJobs === "boolean"
          ? data.enableSmsAlertsNewJobs
          : true,
    additional_notification_radius_buffer_km:
      typeof data.additionalNotificationRadiusBufferKm === "number" && Number.isFinite(data.additionalNotificationRadiusBufferKm)
        ? Math.max(0, Math.min(500, Math.round(data.additionalNotificationRadiusBufferKm)))
        : 50,
    new_listing_reminder_interval_hours:
      typeof data.newListingReminderIntervalHours === "number" &&
      Number.isFinite(data.newListingReminderIntervalHours)
        ? Math.max(1, Math.min(168, Math.round(data.newListingReminderIntervalHours)))
        : 6,
    enable_new_listing_reminders:
      typeof data.enableNewListingReminders === "boolean"
        ? data.enableNewListingReminders
        : true,
    default_cleaner_checklist_items:
      Array.isArray(data.defaultCleanerChecklistItems) &&
      data.defaultCleanerChecklistItems.length > 0
        ? data.defaultCleanerChecklistItems
            .map((v) => String(v ?? "").trim())
            .filter((v) => v.length > 0)
            .slice(0, 64)
        : [
            "Vacuum Apartment/House",
            "Clean all Bedrooms",
            "Clean all Bathrooms",
            "Clean Toilet",
            "Clean Kitchen",
            "Clean Laundry",
            "Mop Floors (if needed)",
          ],
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
    pricing_base_rate_per_bedroom_by_service_type: sanitizePricingBaseRateByServiceForDb(
      data.pricingBaseRatePerBedroomByServiceType
    ),
    pricing_base_multiplier:
      typeof data.pricingBaseMultiplier === "number" && Number.isFinite(data.pricingBaseMultiplier)
        ? Math.max(0.01, data.pricingBaseMultiplier)
        : DEFAULT_PRICING_MODIFIERS.baseMultiplier,
    pricing_base_multiplier_by_service_type: sanitizePricingBaseMultiplierByServiceForDb(
      data.pricingBaseMultiplierByServiceType
    ),
    pricing_bathroom_rate_per_bathroom_by_service_type: sanitizePricingBathroomRateByServiceForDb(
      data.pricingBathroomRatePerBathroomByServiceType
    ),
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
    daily_digest_enabled: false,
    admin_notify_new_user: data.adminNotifyNewUser !== false,
    admin_notify_new_listing: data.adminNotifyNewListing !== false,
    admin_notify_dispute: data.adminNotifyDispute !== false,
    allow_low_amount_listings: data.allowLowAmountListings === true,
    allow_two_minute_auction_test: data.allowTwoMinuteAuctionTest === true,
    default_site_theme: data.defaultSiteTheme === "light" ? "light" : "dark",
    new_listing_in_radius_email:
      typeof data.newListingInRadiusEmail === "boolean" ? data.newListingInRadiusEmail : true,
    new_listing_in_radius_in_app:
      typeof data.newListingInRadiusInApp === "boolean" ? data.newListingInRadiusInApp : true,
    new_listing_in_radius_sms:
      typeof data.newListingInRadiusSms === "boolean"
        ? data.newListingInRadiusSms
        : data.enableSmsAlertsNewJobs !== false,
    new_listing_in_radius_push:
      typeof data.newListingInRadiusPush === "boolean"
        ? data.newListingInRadiusPush
        : data.enableSmsAlertsNewJobs !== false,
    new_listing_outside_email:
      typeof data.newListingOutsideEmail === "boolean" ? data.newListingOutsideEmail : true,
    new_listing_outside_in_app:
      typeof data.newListingOutsideInApp === "boolean" ? data.newListingOutsideInApp : true,
    new_listing_outside_sms:
      typeof data.newListingOutsideSms === "boolean"
        ? data.newListingOutsideSms
        : data.enableSmsAlertsNewJobs !== false,
    new_listing_outside_push:
      typeof data.newListingOutsidePush === "boolean"
        ? data.newListingOutsidePush
        : data.enableSmsAlertsNewJobs !== false,
    enable_daily_browse_jobs_nudge:
      typeof data.enableDailyBrowseJobsNudge === "boolean" ? data.enableDailyBrowseJobsNudge : true,
    service_addons_checklists: sanitizeServiceAddonsChecklistsForDb(
      data.serviceAddonsChecklists ?? null
    ),
    lister_nonresponsive_cancel_idle_days: normalizeListerNonresponsiveCancelIdleDays(
      data.listerNonresponsiveCancelIdleDays
    ),
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
          : msg.includes("pricing_bathroom_rate_per_bathroom_by_service_type")
            ? " Add column global_settings.pricing_bathroom_rate_per_bathroom_by_service_type (see sql/20260417120000_pricing_bathroom_rate_by_service_type.sql)."
          : msg.includes("new_listing_in_radius") || msg.includes("enable_daily_browse")
            ? " Add cleaner new-listing channel columns (see sql/20260417100000_global_settings_new_listing_channel_toggles.sql)."
          : msg.includes("service_addons_checklists")
            ? " Add column global_settings.service_addons_checklists (see sql/20260419120000_global_settings_service_addons_checklists.sql)."
          : msg.includes("lister_nonresponsive_cancel_idle_days")
            ? " Add column global_settings.lister_nonresponsive_cancel_idle_days (see supabase/sql/20260418100000_global_settings_lister_nonresponsive_cancel_idle_days.sql)."
          : " Run supabase/sql/20260417140000_global_settings_ensure_columns_admin_save.sql in the Supabase SQL editor (adds all columns used by Admin → Global Settings save), or apply the individual migrations under supabase/migrations."
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

/** Update only the global emails kill switch. */
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
  revalidatePath("/admin/global-settings");
  revalidateGlobalSettingsCache();
  return { ok: true };
}

export type SendGlobalSettingsTestEmailResult =
  | { ok: true }
  | { ok: false; error: string };

/** Admin: Resend connectivity test from Global settings. */
export async function sendGlobalSettingsTestEmail(
  toEmail: string | null
): Promise<SendGlobalSettingsTestEmailResult> {
  try {
    const supabase = await requireAdmin();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const adminId = session?.user?.id;
    if (!adminId) return { ok: false, error: "Not authenticated" };

    const recipient = toEmail?.trim() || (await getEmailForUserId(adminId));
    if (!recipient) {
      return { ok: false, error: "Enter an email address or add one to your admin account." };
    }
    const fromDisplay = process.env.RESEND_FROM ?? DEFAULT_RESEND_FROM;
    const replyHint = process.env.RESEND_REPLY_TO?.trim()
      ? `<p>Reply-To: <code>${process.env.RESEND_REPLY_TO}</code></p>`
      : "<p><em>No RESEND_REPLY_TO set.</em></p>";
    const html = `<p>This is a <strong>connectivity test</strong> from <strong>Admin → Global settings</strong>.</p>${replyHint}<p>From: <code>${fromDisplay}</code></p><p>Sent at ${new Date().toISOString()}</p>`;
    const { sendEmail } = await import("@/lib/notifications/email");
    const result = await sendEmail(recipient, "Bond Back – Resend test (global settings)", html, {
      log: { userId: adminId, kind: "admin_test_global_settings" },
    });
    if (!result.ok) return { ok: false, error: result.error ?? "Send failed" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}
