"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import type { Database } from "@/types/supabase";
import type { DistanceUnitPref, ThemePreference } from "@/lib/types";
import { validateAbnIfRequired } from "@/lib/actions/validate-abn";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export async function saveProfileSettings(formData: FormData) {
  const full_name = (formData.get("full_name") as string) || null;
  const phone = (formData.get("phone") as string) || null;
  const date_of_birthRaw = (formData.get("date_of_birth") as string) || "";
  const date_of_birth = date_of_birthRaw.trim() ? date_of_birthRaw.trim() : null;
  const suburb = (formData.get("suburb") as string) || null;
  const postcode = (formData.get("postcode") as string) || null;
  const bio = (formData.get("bio") as string) || null;
  const abnRaw = (formData.get("abn") as string) ?? "";
  const abnClean = abnRaw.replace(/\D/g, "").trim();
  if (abnClean.length > 0 && abnClean.length !== 11) {
    return { ok: false, error: "ABN must be 11 digits." };
  }
  if (abnClean.length === 11) {
    const abrResult = await validateAbnIfRequired(abnClean);
    if (!abrResult.ok) return { ok: false, error: abrResult.error };
  }
  const abn = abnClean.length === 11 ? abnClean : null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const admin = createSupabaseAdminClient();
  const db = (admin ?? supabase) as SupabaseClient<Database>;
  const updates: ProfileUpdate = {
    full_name,
    phone,
    date_of_birth: date_of_birth ?? undefined,
    suburb: suburb ?? undefined,
    postcode: postcode ?? undefined,
    bio,
    abn: abn ?? undefined,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from("profiles")
    .update(updates as any)
    .eq("id", session.user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/profile");
  return { ok: true };
}

export type PreferredPayoutSchedule = "daily" | "weekly" | "monthly" | "platform_default";

export type SavePayoutScheduleResult = { ok: true } | { ok: false; error: string };

/** Save cleaner preferred payout schedule; syncs to Stripe Connect account if connected. */
export async function savePayoutSchedule(
  preferred: PreferredPayoutSchedule
): Promise<SavePayoutScheduleResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server error." };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, roles, stripe_connect_id")
    .eq("id", session.user.id)
    .maybeSingle();

  const p = profile as { roles?: string[] | null; stripe_connect_id?: string | null } | null;
  const roles = (p?.roles ?? []) as string[];
  if (!roles.includes("cleaner")) {
    return { ok: false, error: "Only cleaners can set payout schedule." };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      preferred_payout_schedule: preferred,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", session.user.id);

  if (updateError) return { ok: false, error: updateError.message };

  const connectId = p?.stripe_connect_id?.trim();
  if (connectId) {
    const { getGlobalSettings } = await import("@/lib/actions/global-settings");
    const { getEffectivePayoutSchedule } = await import("@/lib/payout-schedule");
    const globalSettings = await getGlobalSettings();
    const platformDefault = (globalSettings?.payout_schedule as "daily" | "weekly" | "monthly") ?? "weekly";
    const effective = getEffectivePayoutSchedule(preferred, platformDefault);
    const { applyPayoutScheduleToStripeAccount } = await import("@/lib/actions/stripe-connect");
    await applyPayoutScheduleToStripeAccount(connectId, effective);
  }

  revalidatePath("/settings");
  revalidatePath("/earnings");
  revalidatePath("/profile");
  return { ok: true };
}

/** Persist theme from header toggle or settings (logged-in users). */
export async function saveThemePreference(
  theme: ThemePreference
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (theme !== "light" && theme !== "dark" && theme !== "system") {
    return { ok: false, error: "Invalid theme." };
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const admin = createSupabaseAdminClient();
  const db = (admin ?? supabase) as SupabaseClient<Database>;
  const { error } = await db
    .from("profiles")
    .update({
      theme_preference: theme,
      updated_at: new Date().toISOString(),
    } as ProfileUpdate as never)
    .eq("id", session.user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

/** Save theme + distance display unit from Settings → Preferences. */
export async function saveUserPreferences(input: {
  theme_preference: ThemePreference;
  distance_unit: DistanceUnitPref;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { theme_preference, distance_unit } = input;
  if (theme_preference !== "light" && theme_preference !== "dark" && theme_preference !== "system") {
    return { ok: false, error: "Invalid theme." };
  }
  if (distance_unit !== "km" && distance_unit !== "mi") {
    return { ok: false, error: "Invalid distance unit." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const admin = createSupabaseAdminClient();
  const db = (admin ?? supabase) as SupabaseClient<Database>;
  const { error } = await db
    .from("profiles")
    .update({
      theme_preference,
      distance_unit,
      updated_at: new Date().toISOString(),
    } as ProfileUpdate as never)
    .eq("id", session.user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

const NOTIFICATION_PREF_KEYS = [
  "email_notifications",
  "new_bid",
  "new_message",
  "job_accepted",
  "job_completed",
  "email_after_photos",
  "email_checklist_updates",
  "dispute",
  "payment_released",
  "listing_published",
  "receipt_emails",
  "weekly_tips",
  "daily_digest",
  "receive_all_non_critical",
  "email_welcome",
  "email_tutorial",
  "sms_enabled",
  "sms_job_alerts",
  "push_enabled",
  "push_new_job",
  "in_app_sound",
  "in_app_vibrate",
] as const;

export async function saveNotificationSettings(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server error." };

  const { data: profile } = await admin
    .from("profiles")
    .select("email_preferences_locked, notification_preferences")
    .eq("id", session.user.id)
    .maybeSingle();

  if ((profile as { email_preferences_locked?: boolean } | null)?.email_preferences_locked) {
    return { ok: false, error: "Notification preferences are locked by an administrator." };
  }

  const current = (profile as { notification_preferences?: Record<string, boolean> | null } | null)
    ?.notification_preferences ?? {};
  const prefs: Record<string, boolean> = { ...current };
  for (const key of NOTIFICATION_PREF_KEYS) {
    prefs[key] = formData.get(key) === "on";
  }
  if (typeof prefs.sms_job_alerts === "boolean") {
    prefs.sms_new_job = prefs.sms_job_alerts;
  }

  const { error } = await admin
    .from("profiles")
    .update({
      notification_preferences: prefs,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", session.user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function savePrivacySettings(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const profilePublic = formData.get("profile_public") === "on";

  const admin = createSupabaseAdminClient();
  const db = (admin ?? supabase) as SupabaseClient<Database>;
  const { error } = await db
    .from("profiles")
    .update({
      profile_public: profilePublic as any,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", session.user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

const MIN_PASSWORD_LENGTH = 6;

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Change the current user's password. Verifies current password by re-authenticating, then updates to the new password.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.email) {
    return { ok: false, error: "You must be logged in." };
  }

  const current = (currentPassword ?? "").trim();
  const newP = (newPassword ?? "").trim();

  if (!current) {
    return { ok: false, error: "Enter your current password." };
  }
  if (newP.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  // Re-authenticate with current password to verify before changing
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: session.user.email,
    password: current,
  });

  if (signInError) {
    if (signInError.message?.toLowerCase().includes("invalid") || signInError.message?.toLowerCase().includes("credentials")) {
      return { ok: false, error: "Current password is incorrect. If you signed in with Google or another provider, you may not have a password set." };
    }
    return { ok: false, error: signInError.message };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newP });

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export type CreateListerSetupSessionResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export type CreateListerSetupSessionOptions = {
  /** Use return URLs that postMessage to opener and close popup instead of full-page redirect. */
  popup?: boolean;
};

/** Create Stripe Checkout Setup Session for lister to save a card. Redirects to Stripe; on success webhook or return-URL fulfillment saves payment method to profile. */
export async function createListerSetupSession(
  options?: CreateListerSetupSessionOptions
): Promise<CreateListerSetupSessionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return { ok: false, error: "You must be logged in." };
  }

  try {
    const { createSetupIntentCheckoutSessionUrl } = await import("@/lib/stripe");
    const url = await createSetupIntentCheckoutSessionUrl(session.user.id, {
      popupReturn: options?.popup === true,
    });
    if (!url) return { ok: false, error: "Failed to create setup session." };
    return { ok: true, url };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.message ?? "Failed to create setup session." };
  }
}

export type DisconnectListerPaymentResult =
  | { ok: true }
  | { ok: false; error: string };

/** Clear saved card / Stripe customer so the lister can connect a different payment method. */
export async function disconnectListerPaymentMethod(): Promise<DisconnectListerPaymentResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be logged in." };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("roles")
    .eq("id", session.user.id)
    .maybeSingle();

  const roles = Array.isArray((profile as { roles?: string[] } | null)?.roles)
    ? ((profile as { roles: string[] }).roles ?? []).filter((r) => r === "lister" || r === "cleaner")
    : [];
  if (!roles.includes("lister")) {
    return { ok: false, error: "Only listers can disconnect saved payment methods." };
  }

  const { error } = await admin
    .from("profiles")
    .update({
      stripe_payment_method_id: null,
      stripe_customer_id: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", session.user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/settings");
  return { ok: true };
}

export type FulfillListerSetupResult = { ok: true } | { ok: false; error: string };

/** After return from Stripe Checkout (setup mode), retrieve session and save payment method to profile. Works without webhook (e.g. local dev). */
export async function fulfillListerSetupFromSession(checkoutSessionId: string): Promise<FulfillListerSetupResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return { ok: false, error: "You must be logged in." };
  }

  let stripe: import("stripe").default;
  try {
    const { getStripeServer } = await import("@/lib/stripe");
    stripe = await getStripeServer();
  } catch {
    return { ok: false, error: "Stripe is not configured." };
  }

  const cs = await stripe.checkout.sessions.retrieve(checkoutSessionId, { expand: ["setup_intent"] });
  if (cs.mode !== "setup") {
    return { ok: false, error: "Invalid session type." };
  }

  const setupForLister = cs.metadata?.setup_for_lister as string | undefined;
  if (setupForLister !== session.user.id) {
    return { ok: false, error: "This session was for a different user." };
  }

  const setupIntent = cs.setup_intent as Stripe.SetupIntent | null;
  const pmId = typeof setupIntent?.payment_method === "string" ? setupIntent.payment_method : setupIntent?.payment_method?.id ?? null;
  const customerId = typeof cs.customer === "string" ? cs.customer : cs.customer?.id ?? null;

  if (!pmId) {
    return { ok: false, error: "No payment method in session." };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error." };
  }

  const { error } = await admin
    .from("profiles")
    .update({
      stripe_payment_method_id: pmId,
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", session.user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}
