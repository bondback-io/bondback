"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  /** When false, disables new-job SMS and push alerts (cleaner prefs apply when true). */
  enable_sms_alerts_new_jobs?: boolean;
  max_sms_per_user_per_day?: number | null;
  max_push_per_user_per_day?: number | null;
};

/** Normalize DB boolean (PostgREST returns boolean; guard edge cases). */
function normalizeRequireAbn(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

/**
 * Whether ABR lookup is required for ABN validation. Prefers service role so this matches
 * admin global_settings even when the caller has no session (anon cannot SELECT global_settings under RLS).
 */
export async function getRequireAbnForValidation(): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("global_settings")
      .select("require_abn")
      .eq("id", 1)
      .maybeSingle();
    if (!error && data != null) {
      return normalizeRequireAbn((data as { require_abn?: unknown }).require_abn);
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[getRequireAbnForValidation] admin read failed", error);
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
  if (admin) {
    const { data, error } = await admin
      .from("global_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!error) {
      return (data as GlobalSettingsRow | null) ?? null;
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(
        "[getGlobalSettings] admin read failed",
        error.message,
        error.code,
        error.details ?? error.hint
      );
    }
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("global_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(
        "[getGlobalSettings] session read failed (expected for non-admins without service role)",
        error.message,
        error.code,
        error.details ?? error.hint
      );
    }
    return null;
  }
  return (data as GlobalSettingsRow | null) ?? null;
}

/** Email template overrides and per-type enabled flags from email_template_overrides table (no global_settings columns). */
export async function getEmailTemplateOverrides(): Promise<{
  email_templates: Record<string, { subject: string; body: string; active: boolean }>;
  email_type_enabled: Record<string, boolean>;
}> {
  const supabase = await createServerSupabaseClient();
  const { data: rows } = await supabase
    .from("email_template_overrides")
    .select("template_key, subject, body, active, type_enabled");
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
  maxSmsPerUserPerDay?: number | null;
  maxPushPerUserPerDay?: number | null;
};

export type SaveGlobalSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveGlobalSettings(
  data: SaveGlobalSettingsInput
): Promise<SaveGlobalSettingsResult> {
  const supabase = await requireAdmin();

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
    max_sms_per_user_per_day: data.maxSmsPerUserPerDay ?? null,
    max_push_per_user_per_day: data.maxPushPerUserPerDay ?? null,
  };

  const { error } = await supabase
    .from("global_settings")
    .upsert(row as never, { onConflict: "id" });

  if (error) {
    const msg = error.message;
    const hint =
      msg.includes("does not exist") || msg.includes("42703")
        ? " Run the migration: supabase/migrations/20250308120000_global_settings.sql (or create the global_settings table with announcement_text, announcement_active, etc.)."
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
    },
  });

  revalidatePath("/admin/global-settings");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/emails");
  revalidatePath("/");

  // Clear Stripe config/server cache so next request uses the new test/live mode
  const { clearStripeConfigCache } = await import("@/lib/stripe/config");
  const { clearStripeServerCache } = await import("@/lib/stripe");
  clearStripeConfigCache();
  clearStripeServerCache();

  return { ok: true };
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
  return { ok: true };
}

