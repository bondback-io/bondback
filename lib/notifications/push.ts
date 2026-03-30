/**
 * Expo Push Notifications for critical, high-value events.
 * Env: EXPO_ACCESS_TOKEN (optional, for higher rate limits).
 * Rate limit: max 5 push per user per day (UTC).
 */

import { Expo } from "expo-server-sdk";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_MAX_PUSH_PER_USER_PER_DAY = 5;

function getExpoClient(): Expo | null {
  try {
    return new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN ?? undefined });
  } catch {
    return null;
  }
}

async function getMaxPushPerUserPerDay(): Promise<number> {
  try {
    const { getGlobalSettings } = await import("@/lib/actions/global-settings");
    const settings = await getGlobalSettings();
    const max = (settings as { max_push_per_user_per_day?: number | null })?.max_push_per_user_per_day;
    if (typeof max === "number" && max >= 1 && max <= 100) return max;
  } catch {
    // ignore
  }
  return DEFAULT_MAX_PUSH_PER_USER_PER_DAY;
}

/**
 * Check if the user is under the daily push limit and, if so, increment the count.
 * Returns true if we may send a push (and have recorded this send); false if over limit.
 */
export async function checkAndIncrementPushRateLimit(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  const maxPerDay = await getMaxPushPerUserPerDay();
  const dateUtc = new Date().toISOString().slice(0, 10);

  const { data: row } = await (admin as any)
    .from("push_daily_sends")
    .select("count")
    .eq("user_id", userId)
    .eq("date_utc", dateUtc)
    .maybeSingle();

  const current = (row?.count ?? 0) as number;
  if (current >= maxPerDay) return false;

  const { error } = await (admin as any)
    .from("push_daily_sends")
    .upsert(
      { user_id: userId, date_utc: dateUtc, count: current + 1 },
      { onConflict: "user_id,date_utc" }
    );

  if (error) {
    console.error("[notifications/push] rate limit increment failed", userId, error);
    return false;
  }
  return true;
}

const DEFAULT_MAX_SYNC_PUSH_PER_USER_PER_HOUR = 3;

/**
 * Check and increment sync push rate limit (for bid_sync_success / bid_sync_failure).
 * Max 3 per user per hour. Returns true if we may send and have recorded this send.
 */
export async function checkAndIncrementSyncPushRateLimit(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  const hourUtc = new Date().toISOString().slice(0, 13); // "2025-03-08T14"

  const { data: row } = await (admin as any)
    .from("push_sync_hourly")
    .select("count")
    .eq("user_id", userId)
    .eq("hour_utc", hourUtc)
    .maybeSingle();

  const current = (row?.count ?? 0) as number;
  if (current >= DEFAULT_MAX_SYNC_PUSH_PER_USER_PER_HOUR) return false;

  const { error } = await (admin as any)
    .from("push_sync_hourly")
    .upsert(
      { user_id: userId, hour_utc: hourUtc, count: current + 1 },
      { onConflict: "user_id,hour_utc" }
    );

  if (error) {
    console.error("[notifications/push] sync rate limit increment failed", userId, error);
    return false;
  }
  return true;
}

/**
 * Send a push using sync rate limit (3/hour). Used for background sync completion/failure.
 * Does not consume the daily push limit.
 */
export async function sendSyncPushToUser(
  userId: string,
  pushToken: string,
  payload: PushPayload
): Promise<{ ok: boolean; sent?: boolean; error?: string }> {
  const allowed = await checkAndIncrementSyncPushRateLimit(userId);
  if (!allowed) return { ok: true, sent: false };

  const client = getExpoClient();
  if (!client) return { ok: true, sent: false };

  const token = (pushToken ?? "").trim();
  if (!token || !Expo.isExpoPushToken(token)) {
    return { ok: true, sent: false };
  }

  try {
    const messages = [
      {
        to: token,
        title: payload.title,
        body: payload.body.slice(0, 255),
        data: payload.data ?? {},
        sound: "default" as const,
      },
    ];
    const chunks = client.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await client.sendPushNotificationsAsync(chunk);
    }
    return { ok: true, sent: true };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, sent: false, error: err.message ?? "Expo push failed" };
  }
}

export type PushPayload = {
  title: string;
  body: string;
  data?: { jobId?: string; listingId?: string; type: string };
};

/**
 * Send a single push notification to an Expo push token. Uses rate limiting per userId.
 * Returns ok: true if sent or skipped (no config/limit); ok: false on Expo error.
 * When sent is true, the push was actually sent.
 */
export async function sendPushToUser(
  userId: string,
  pushToken: string,
  payload: PushPayload
): Promise<{ ok: boolean; sent?: boolean; error?: string }> {
  const allowed = await checkAndIncrementPushRateLimit(userId);
  if (!allowed) return { ok: true, sent: false };

  const client = getExpoClient();
  if (!client) return { ok: true, sent: false };

  const token = (pushToken ?? "").trim();
  if (!token || !Expo.isExpoPushToken(token)) {
    return { ok: true, sent: false };
  }

  try {
    const messages = [
      {
        to: token,
        title: payload.title,
        body: payload.body.slice(0, 255),
        data: payload.data ?? {},
        sound: "default" as const,
      },
    ];
    const chunks = client.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await client.sendPushNotificationsAsync(chunk);
    }
    return { ok: true, sent: true };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, sent: false, error: err.message ?? "Expo push failed" };
  }
}

/** Alias for `sendPushToUser` (server-side Expo push). */
export const sendPush = sendPushToUser;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";

/** Event types we send as push (same as SMS: critical / high-value only). */
export const PUSH_NOTIFICATION_TYPES = new Set<string>([
  "new_bid",
  "new_message",
  "job_accepted",
  "job_created",
  "job_approved_to_start",
  "job_completed",
  "payment_released",
  "dispute_opened",
  "dispute_resolved",
  "listing_live",
  "after_photos_uploaded",
  "auto_release_warning",
  "checklist_all_complete",
  "new_job_in_area",
  "job_status_update",
  "funds_ready",
]);

/**
 * Build push title, body, and data for a notification type. Used by createNotification and new-job flow.
 */
export function buildPushPayload(
  type: string,
  jobId: number | null,
  options?: {
    listingId?: number;
    listingUuid?: string | null;
    listingTitle?: string | null;
    amountCents?: number | null;
    suburb?: string | null;
    postcode?: string | null;
    minPriceCents?: number;
    maxPriceCents?: number;
    senderName?: string | null;
  }
): PushPayload {
  const id = jobId != null ? String(jobId) : "";
  const listingIdStr =
    options?.listingUuid?.trim() ||
    (options?.listingId != null ? String(options.listingId) : id);

  switch (type) {
    case "new_bid": {
      const who = (options?.senderName ?? "").trim();
      const amt =
        options?.amountCents != null
          ? `$${(options.amountCents / 100).toFixed(2)}`
          : "";
      const body =
        who && amt
          ? `${who} bid ${amt}. Tap to view.`
          : who
            ? `${who} placed a bid. Tap to view.`
            : amt
              ? `New bid ${amt}. Tap to view.`
              : "New bid on your listing. Tap to view.";
      return {
        title: "New bid",
        body,
        data: { jobId: listingIdStr, listingId: listingIdStr, type: "new_bid" },
      };
    }
    case "new_message": {
      const who = (options?.senderName ?? "").trim() || "Someone";
      return {
        title: "New message",
        body: `${who} messaged you in Job #${id || "?"}. Tap to open chat.`,
        data: { jobId: id, type: "new_message" },
      };
    }
    case "job_accepted":
    case "job_created":
      return {
        title: "Bid accepted",
        body: `Your bid was accepted! ${(options?.listingTitle ?? "Job").toString().slice(0, 40)}. Tap to view.`,
        data: { jobId: id, type: "job_accepted" },
      };
    case "job_approved_to_start":
      return {
        title: "Job approved",
        body: `Lister approved – start Job #${id}. Tap to open.`,
        data: { jobId: id, type: "job_approved_to_start" },
      };
    case "job_completed":
      return {
        title: "Job marked complete",
        body: "The cleaner marked the job complete. Tap to review and release payment.",
        data: { jobId: id, type: "job_completed" },
      };
    case "payment_released":
      const amount =
        options?.amountCents != null ? `$${(options.amountCents / 100).toFixed(0)}` : "";
      return {
        title: "Payment received",
        body: amount
          ? `Payment of ${amount} received for Job #${id}. Tap to view earnings.`
          : `Payment received for Job #${id}. Tap to view earnings.`,
        data: { jobId: id, type: "payment_released" },
      };
    case "dispute_opened":
      return {
        title: "Dispute opened",
        body: `Dispute on Job #${id}. Tap to respond.`,
        data: { jobId: id, type: "dispute_opened" },
      };
    case "dispute_resolved":
      return {
        title: "Dispute resolved",
        body: `Dispute on Job #${id} – outcome is final. Tap to view.`,
        data: { jobId: id, type: "dispute_resolved" },
      };
    case "new_job_near_you":
    case "new_job_in_area": {
      const suburb = (options?.suburb ?? "").trim() || "Your area";
      const postcode = (options?.postcode ?? "").trim();
      const loc = postcode ? `${suburb} (${postcode})` : suburb;
      const minD = options?.minPriceCents != null ? Math.round(options.minPriceCents / 100) : 0;
      const maxD = options?.maxPriceCents != null ? Math.round(options.maxPriceCents / 100) : 0;
      const priceRange = minD === maxD ? `$${minD}` : `$${minD}–$${maxD}`;
      return {
        title: "New Job Alert",
        body: `New bond clean job in ${loc} – ${priceRange}. Bid now!`,
        data: { jobId: listingIdStr, listingId: listingIdStr, type: "new_job" },
      };
    }
    case "listing_live":
      return {
        title: "Listing published",
        body: (options?.listingTitle ?? "Your listing").toString().slice(0, 80) + " is live. Tap to view.",
        data: {
          type: "listing_live",
          listingId: listingIdStr || undefined,
          jobId: listingIdStr || undefined,
        },
      };
    case "after_photos_uploaded":
      return {
        title: "After photos ready",
        body: `The cleaner uploaded after photos for Job #${id}. Tap to review.`,
        data: { jobId: id, type: "after_photos_uploaded" },
      };
    case "auto_release_warning":
      return {
        title: "Auto-release soon",
        body: `Job #${id}: funds will auto-release in about 24 hours unless you act. Tap to review.`,
        data: { jobId: id, type: "auto_release_warning" },
      };
    case "checklist_all_complete":
      return {
        title: "Checklist complete",
        body: `Every checklist item is done on Job #${id}. Tap to open the job.`,
        data: { jobId: id, type: "checklist_all_complete" },
      };
    case "job_status_update":
      return {
        title: "Job update",
        body: "There’s an update on your job. Tap to open.",
        data: { jobId: id, type: "job_status_update" },
      };
    case "funds_ready":
      return {
        title: "Review & release",
        body: `Job #${id}: review photos and release funds or wait for auto-release.`,
        data: { jobId: id, type: "funds_ready" },
      };
    default:
      return {
        title: "Bond Back",
        body: "You have a new notification.",
        data: { jobId: id, type },
      };
  }
}

/**
 * Send "new job near you" push to a cleaner. Uses rate limit (max 5/day unless overridden).
 * Respects profiles.notification_preferences.push_new_job + expo_push_token.
 */
export async function sendNewJobPushAlert(
  cleanerId: string,
  listingId: string,
  suburb: string,
  postcode: string,
  minPriceCents: number,
  maxPriceCents: number
): Promise<{ ok: boolean; sent?: boolean; error?: string }> {
  const { getNotificationPrefs } = await import("@/lib/supabase/admin");
  const prefs = await getNotificationPrefs(cleanerId);
  if (!prefs.shouldSendPushNewJob?.() || !prefs.expoPushToken) {
    return { ok: true, sent: false };
  }
  const payload = buildPushPayload("new_job_near_you", null, {
    listingId: Number(listingId),
    suburb,
    postcode,
    minPriceCents,
    maxPriceCents,
  });
  return sendPushToUser(cleanerId, prefs.expoPushToken, payload);
}
