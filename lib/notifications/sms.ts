/**
 * SMS via Twilio for critical, high-value events.
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (Australian E.164 preferred).
 * Rate limit: max 5 SMS per user per day (UTC).
 */

import Twilio from "twilio";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getAppBaseUrl } from "@/lib/site";
import { listingDetailPath } from "@/lib/marketplace/paths";

const DEFAULT_MAX_SMS_PER_USER_PER_DAY = 5;

async function getMaxSmsPerUserPerDay(): Promise<number> {
  try {
    const { getGlobalSettings } = await import("@/lib/actions/global-settings");
    const settings = await getGlobalSettings();
    const max = (settings as { max_sms_per_user_per_day?: number | null })?.max_sms_per_user_per_day;
    if (typeof max === "number" && max >= 1 && max <= 100) return max;
  } catch {
    // ignore
  }
  return DEFAULT_MAX_SMS_PER_USER_PER_DAY;
}

function getTwilioClient(): Twilio.Twilio | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return Twilio(sid, token);
}

/**
 * Send an SMS via Twilio. Returns ok: true if sent or skipped (no config); ok: false on Twilio error.
 * Does not perform rate limiting; use sendSmsToUser for rate-limited sends.
 */
export async function sendSms(
  to: string,
  message: string
): Promise<{ ok: boolean; error?: string; sid?: string }> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!client || !from?.trim()) {
    return { ok: true }; // no-op when not configured
  }

  const normalized = to.trim().replace(/^\s*0/, "+61").replace(/^(\d{9})$/, "+61$1");
  const toE164 = normalized.startsWith("+") ? normalized : `+61${normalized.replace(/\D/g, "").slice(-9)}`;

  try {
    const msg = await client.messages.create({
      body: message.slice(0, 1600),
      from: from.trim(),
      to: toE164,
    });
    return { ok: true, sid: msg.sid };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: err.message ?? "Twilio SMS failed" };
  }
}

/**
 * Check if the user is under the daily SMS limit and, if so, increment the count.
 * Returns true if we may send an SMS (and have recorded this send); false if over limit.
 */
export async function checkAndIncrementSmsRateLimit(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  const maxPerDay = await getMaxSmsPerUserPerDay();
  const dateUtc = new Date().toISOString().slice(0, 10);

  const { data: row } = await (admin as any)
    .from("sms_daily_sends")
    .select("count")
    .eq("user_id", userId)
    .eq("date_utc", dateUtc)
    .maybeSingle();

  const current = (row?.count ?? 0) as number;
  if (current >= maxPerDay) return false;

  const { error } = await (admin as any)
    .from("sms_daily_sends")
    .upsert(
      { user_id: userId, date_utc: dateUtc, count: current + 1 },
      { onConflict: "user_id,date_utc" }
    );

  if (error) {
    console.error("[notifications/sms] rate limit increment failed", userId, error);
    return false;
  }
  return true;
}

/**
 * Send SMS to a user with rate limiting. Use for notification-triggered SMS.
 * Returns ok: true if sent or skipped (no config/limit); ok: false on Twilio error.
 * When sent is true, the SMS was actually sent (not skipped by limit or missing config).
 */
export async function sendSmsToUser(
  userId: string,
  to: string,
  message: string
): Promise<{ ok: boolean; sent?: boolean; error?: string }> {
  const allowed = await checkAndIncrementSmsRateLimit(userId);
  if (!allowed) return { ok: true, sent: false };
  const result = await sendSms(to, message);
  return { ...result, sent: result.ok };
}

/** Reusable server-side Twilio send (alias of {@link sendSms}). */
export async function sendSMS(
  to: string,
  message: string
): Promise<{ ok: boolean; error?: string; sid?: string }> {
  return sendSms(to, message);
}

export type GlobalSmsSettingsSlice = {
  enable_sms_notifications?: boolean | null;
  sms_type_enabled?: Record<string, boolean> | null;
};

/**
 * Master switch + optional per-type map on global_settings.
 * Empty sms_type_enabled means all configured types may send.
 */
export function isTwilioSmsAllowedForType(
  settings: GlobalSmsSettingsSlice | null | undefined,
  type: string
): boolean {
  if (settings?.enable_sms_notifications === false) return false;
  const map = settings?.sms_type_enabled;
  if (!map || typeof map !== "object" || Object.keys(map).length === 0) {
    return true;
  }
  return map[type] !== false;
}

/**
 * Send "new job near you" SMS to a cleaner. Uses rate limit (max 5/day unless overridden by global_settings).
 * Message links to the live listing (`/listings/[uuid]`).
 */
export async function sendNewJobAlert(
  cleanerId: string,
  listingId: string,
  suburb: string,
  _postcode: string,
  minPriceCents: number,
  maxPriceCents: number,
  bedrooms: number
): Promise<{ ok: boolean; sent?: boolean; error?: string }> {
  const settings = await getGlobalSettings();
  if (!isTwilioSmsAllowedForType(settings, "new_job_in_area")) {
    return { ok: true, sent: false };
  }

  const { getNotificationPrefs } = await import("@/lib/supabase/admin");
  const prefs = await getNotificationPrefs(cleanerId);
  if (!prefs.phone) return { ok: true, sent: false };
  if (!prefs.shouldSendSmsNewJob?.()) return { ok: true, sent: false };

  const suburbDisplay = (suburb ?? "").trim() || "Your area";
  const beds = Math.max(1, Math.min(20, Number.isFinite(bedrooms) ? Math.floor(bedrooms) : 1));
  const midAud = Math.round((minPriceCents + maxPriceCents) / 2 / 100);
  const base = getAppBaseUrl().replace(/\/$/, "");
  const message = `New bond clean in ${suburbDisplay}: ${beds} bed, $${midAud}. View now: ${base}${listingDetailPath(listingId)}`;

  return sendSmsToUser(cleanerId, prefs.phone, message);
}
