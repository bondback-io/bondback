/**
 * Twilio SMS sending with rate limit (max 3 SMS per user per day).
 * Env: TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (E.164).
 */

import Twilio from "twilio";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_SMS_PER_USER_PER_DAY = 5;

function getTwilioClient(): Twilio.Twilio | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return Twilio(sid, token);
}

/**
 * Send an SMS via Twilio. Returns ok: true if sent or skipped (no config); ok: false on Twilio error.
 * Does not perform rate limiting; caller must call checkAndIncrementSmsRateLimit before this.
 */
export async function sendSms(
  to: string,
  body: string
): Promise<{ ok: boolean; error?: string; sid?: string }> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!client || !from?.trim()) {
    return { ok: true }; // no-op when not configured
  }

  // E.164: ensure Australian numbers have +61
  const normalized = to.trim().replace(/^\s*0/, "+61").replace(/^(\d{9})$/, "+61$1");
  const toE164 = normalized.startsWith("+") ? normalized : `+61${normalized.replace(/\D/g, "").slice(-9)}`;

  try {
    const message = await client.messages.create({
      body: body.slice(0, 1600), // Twilio limit 1600 chars
      from: from.trim(),
      to: toE164,
    });
    return { ok: true, sid: message.sid };
  } catch (e) {
    const err = e as { message?: string; code?: number };
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

  const dateUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: row } = await (admin as any)
    .from("sms_daily_sends")
    .select("count")
    .eq("user_id", userId)
    .eq("date_utc", dateUtc)
    .maybeSingle();

  const current = (row?.count ?? 0) as number;
  if (current >= MAX_SMS_PER_USER_PER_DAY) return false;

  const { error } = await (admin as any)
    .from("sms_daily_sends")
    .upsert(
      { user_id: userId, date_utc: dateUtc, count: current + 1 },
      { onConflict: "user_id,date_utc" }
    );

  if (error) {
    console.error("[twilio/sms] rate limit increment failed", userId, error);
    return false;
  }
  return true;
}
