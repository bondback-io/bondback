import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Server-only. Use only for admin operations (e.g. resolving user email for notifications).
 * Requires SUPABASE_SERVICE_ROLE_KEY in env. Do not expose to client.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Get user email by id (server-only). Returns null if admin client not configured or user not found. */
export async function getEmailForUserId(userId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

/** Build a map of user id -> email (server-only, admin). Paginates to fetch all. */
export async function getAllUserEmailsMap(): Promise<Map<string, string>> {
  const admin = createSupabaseAdminClient();
  const map = new Map<string, string>();
  if (!admin) return map;

  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      if (u.email) map.set(u.id, u.email);
    }
    if (data.users.length < perPage) break;
    page++;
  }
  return map;
}

export type NotificationPrefsResult = {
  email: string | null;
  phone: string | null;
  emailNotifications: boolean;
  /** Resolve whether to send email for this notification type (checks preferences + force-disabled) */
  shouldSendEmail: (type: string) => boolean;
  /** Resolve whether to send SMS for this notification type (checks sms pref + phone present) */
  shouldSendSms: (type: string) => boolean;
  /** True when user wants new-job-near-me SMS (sms_new_job + phone) */
  shouldSendSmsNewJob: () => boolean;
  /** Expo push token (from mobile app); null if not set */
  expoPushToken: string | null;
  /** True when user has push_enabled and a token */
  shouldSendPush: (type: string) => boolean;
  /** Push alerts for new listings near the cleaner (push_new_job + token); independent of other push types */
  shouldSendPushNewJob: () => boolean;
  notificationPreferences: Record<string, boolean> | null;
  emailForceDisabled: boolean;
}

/** SMS-enabled notification types (critical, high-value events only). */
const SMS_NOTIFICATION_TYPES = new Set([
  "new_bid",
  "job_accepted",
  "job_created",
  "job_approved_to_start",
  "payment_released",
  "dispute_opened",
]);

/** Push-enabled notification types (same critical/high-value events + new job near you). */
const PUSH_NOTIFICATION_TYPES = new Set([
  "new_bid",
  "new_message",
  "job_accepted",
  "job_created",
  "job_approved_to_start",
  "job_completed",
  "payment_released",
  "dispute_opened",
  "dispute_resolved",
]);

/** Get email, phone, and notification preferences for a user (server-only). Used when sending notification emails and SMS. */
export async function getNotificationPrefs(userId: string): Promise<NotificationPrefsResult> {
  const admin = createSupabaseAdminClient();
  const noSend = (): NotificationPrefsResult => ({
    email: null,
    phone: null,
    emailNotifications: false,
    shouldSendEmail: () => false,
    shouldSendSms: () => false,
    shouldSendSmsNewJob: () => false,
    expoPushToken: null,
    shouldSendPush: () => false,
    shouldSendPushNewJob: () => false,
    notificationPreferences: null,
    emailForceDisabled: true,
  });
  if (!admin) return noSend();

  const [authRes, profileRes] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin
      .from("profiles")
      .select("notification_preferences, email_force_disabled, phone, expo_push_token")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  const email = authRes.data?.user?.email ?? null;
  const profile = profileRes.data as {
    notification_preferences?: Record<string, boolean> | null;
    email_force_disabled?: boolean | null;
    phone?: string | null;
    expo_push_token?: string | null;
  } | null;
  const notificationPreferences = profile?.notification_preferences ?? null;
  const emailForceDisabled = profile?.email_force_disabled === true;
  const phone = (profile?.phone ?? "").trim() || null;
  const smsEnabled = notificationPreferences?.sms_enabled === true;
  const smsNewJobEnabled = notificationPreferences?.sms_new_job === true;
  const pushEnabled = notificationPreferences?.push_enabled === true;
  const pushNewJobEnabled = notificationPreferences?.push_new_job === true;
  const expoPushToken = (profile?.expo_push_token ?? "").trim() || null;

  const { shouldSendEmailForType } = await import("@/lib/notification-preferences");
  const shouldSendEmail = (type: string) =>
    !!email && shouldSendEmailForType(notificationPreferences, type, emailForceDisabled);

  const shouldSendSms = (type: string) =>
    !!phone && smsEnabled && SMS_NOTIFICATION_TYPES.has(type);

  const shouldSendSmsNewJob = () => !!phone && smsNewJobEnabled;

  const shouldSendPushNewJob = () => !!expoPushToken && pushNewJobEnabled;

  /** Non–new-job push types require master push_enabled. New job alerts use shouldSendPushNewJob only. */
  const shouldSendPush = (type: string) =>
    !!expoPushToken && pushEnabled && PUSH_NOTIFICATION_TYPES.has(type);

  return {
    email: email ?? null,
    phone,
    emailNotifications: !!email && !emailForceDisabled,
    shouldSendEmail,
    shouldSendSms,
    shouldSendSmsNewJob,
    expoPushToken,
    shouldSendPush,
    shouldSendPushNewJob,
    notificationPreferences,
    emailForceDisabled,
  };
}

const RATE_LIMIT_HOURS = 1;
const VIEWED_WITHIN_MINUTES = 5;

/**
 * Throttle noisy job emails (e.g. new_message): max one per job per hour **per recipient**.
 * If true, records the send time. Call only when about to send.
 */
export async function checkAndRecordEmailRateLimit(
  jobId: number,
  recipientUserId: string
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return true;
  const { data: row } = await (admin as any)
    .from("notification_email_rate_limit")
    .select("last_sent_at")
    .eq("job_id", jobId)
    .eq("user_id", recipientUserId)
    .maybeSingle();

  const lastSent = row?.last_sent_at as string | undefined;
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000).toISOString();
  if (lastSent && lastSent > oneHourAgo) return false;

  await (admin as any).from("notification_email_rate_limit").upsert(
    {
      job_id: jobId,
      user_id: recipientUserId,
      last_sent_at: new Date().toISOString(),
    },
    { onConflict: "job_id,user_id" }
  );
  return true;
}

/**
 * True if the recipient viewed this job page within the last few minutes (so we can skip new-message email).
 * Uses service role to read last_job_view.
 */
export async function recipientViewedJobRecently(recipientUserId: string, jobId: number): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const { data: row } = await (admin as any)
    .from("last_job_view")
    .select("viewed_at")
    .eq("user_id", recipientUserId)
    .eq("job_id", jobId)
    .maybeSingle();

  const viewedAt = row?.viewed_at as string | undefined;
  if (!viewedAt) return false;
  const cutoff = new Date(Date.now() - VIEWED_WITHIN_MINUTES * 60 * 1000).toISOString();
  return viewedAt > cutoff;
}

export type EmailLogStatus = "sent" | "failed" | "skipped";

/**
 * Log an email attempt for admin visibility (email_logs). Safe to call without blocking sends.
 */
export async function logEmailDelivery(params: {
  userId: string | null;
  kind: string;
  subject: string;
  to: string;
  status: EmailLogStatus;
  errorMessage?: string | null;
}): Promise<void> {
  const masked = params.to.replace(/^(.{0,2}).+(@.+)$/, (_, a: string, d: string) => `${a}***${d}`);
  const line = `[email] ${params.status} kind=${params.kind} to=${masked} subject=${params.subject.slice(0, 80)}${params.subject.length > 80 ? "…" : ""}`;
  if (params.status === "failed" && params.errorMessage) {
    console.error(line, params.errorMessage);
  } else {
    console.info(line);
  }

  if (!params.userId) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    await (admin as any).from("email_logs").insert({
      user_id: params.userId,
      type: params.kind,
      subject: params.subject,
      status: params.status,
      error_message: params.errorMessage ?? null,
      recipient_email: params.to,
    });
  } catch (e) {
    console.warn("[logEmailDelivery] insert failed", e);
  }
}

