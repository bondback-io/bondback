import { createClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { shouldSendEmailForType } from "@/lib/notification-preferences";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

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

/**
 * Paginate through Supabase Auth (admin API). Use for admin directory + email maps so the
 * dashboard matches Authentication → Users even when `profiles` rows are missing.
 */
export async function listAllAuthUsersPaginated(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>
): Promise<User[]> {
  const users: User[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn("[listAllAuthUsersPaginated]", error.message);
      break;
    }
    if (!data?.users?.length) break;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page++;
  }
  return users;
}

/** Build id → email from Auth users (no extra API call if you already have the list). */
export function emailsMapFromAuthUsers(users: User[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of users) {
    if (u.email) map.set(u.id, u.email);
  }
  return map;
}

/** Build id → last sign-in (ISO string) from Auth users — true “last login” for admin tables. */
export function lastSignInMapFromAuthUsers(users: User[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const u of users) {
    map.set(u.id, u.last_sign_in_at ?? null);
  }
  return map;
}

/**
 * Minimal `profiles` row for an Auth user with no DB profile yet (orphaned auth account).
 */
export function syntheticProfileFromAuthUser(u: User): ProfileRow {
  const md = (u.user_metadata ?? {}) as Record<string, unknown>;
  const roles = Array.isArray(md.roles) ? (md.roles as string[]) : [];
  const activeRole = md.active_role === "cleaner" ? "cleaner" : "lister";
  return {
    id: u.id,
    full_name: (typeof md.full_name === "string" ? md.full_name : null) ?? u.email ?? null,
    first_name: typeof md.given_name === "string" ? md.given_name : null,
    last_name: typeof md.family_name === "string" ? md.family_name : null,
    avatar_url:
      (typeof md.picture === "string" && md.picture) ||
      (typeof md.avatar_url === "string" && md.avatar_url) ||
      null,
    created_at: u.created_at,
    updated_at: u.updated_at ?? u.created_at,
    profile_photo_url: null,
    bio: null,
    phone: null,
    suburb: "",
    postcode: null,
    state: null,
    abn: null,
    roles,
    active_role: activeRole,
    specialties: null,
    portfolio_photo_urls: null,
    availability: null,
    notification_preferences: null,
    email_force_disabled: null,
    max_travel_km: 0,
    business_name: null,
    insurance_policy_number: null,
    equipment_notes: null,
    email_preferences_locked: null,
    is_admin: md.is_admin === true ? true : null,
    is_deleted: null,
    date_of_birth: null,
    years_experience: null,
    vehicle_type: null,
    stripe_connect_id: null,
    stripe_payment_method_id: null,
    stripe_customer_id: null,
    expo_push_token: null,
    verification_badges: [],
    is_email_verified: !!u.email_confirmed_at,
    referred_by: null,
    referral_code: null,
    account_credit_cents: 0,
    high_dispute_opens_30d: 0,
    last_dispute_abuse_alert_at: null,
    preferred_payout_schedule: "weekly",
    theme_preference: null,
    distance_unit: null,
    cleaner_username: null,
    cleaner_avg_rating: null,
    cleaner_total_reviews: null,
  };
}

/**
 * Union of `profiles` rows and Auth users: every auth account appears even without a profile row.
 */
export function mergeProfilesWithAuthUsers<T extends { id: string; created_at?: string }>(
  profiles: T[],
  authUsers: User[]
): T[] {
  const byId = new Map<string, T>(profiles.map((p) => [p.id, p]));
  for (const u of authUsers) {
    if (!byId.has(u.id)) {
      byId.set(u.id, syntheticProfileFromAuthUser(u) as unknown as T);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}

/** Build a map of user id -> email (server-only, admin). Paginates to fetch all. */
export async function getAllUserEmailsMap(): Promise<Map<string, string>> {
  const admin = createSupabaseAdminClient();
  if (!admin) return new Map();
  const users = await listAllAuthUsersPaginated(admin);
  return emailsMapFromAuthUsers(users);
}

export type NotificationPrefsResult = {
  email: string | null;
  phone: string | null;
  emailNotifications: boolean;
  /** Resolve whether to send email for this notification type (checks preferences + force-disabled) */
  shouldSendEmail: (type: string) => boolean;
  /** Resolve whether to send SMS for this notification type (checks sms pref + phone present) */
  shouldSendSms: (type: string) => boolean;
  /** True when user wants new-job-near-me SMS (sms_job_alerts + sms_enabled + phone) */
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
  "auto_release_warning",
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
  "listing_live",
  "after_photos_uploaded",
  "auto_release_warning",
  "checklist_all_complete",
  "new_job_in_area",
  "job_status_update",
  "funds_ready",
  "listing_cancelled_by_lister",
]);

let loggedMissingServiceRoleForPrefs = false;

function buildNotificationPrefsResult(params: {
  email: string | null;
  profile: {
    notification_preferences?: Record<string, boolean> | null;
    email_force_disabled?: boolean | null;
    phone?: string | null;
    expo_push_token?: string | null;
  } | null;
}): NotificationPrefsResult {
  const { email, profile } = params;
  const notificationPreferences = profile?.notification_preferences ?? null;
  const emailForceDisabled = profile?.email_force_disabled === true;
  const phone = (profile?.phone ?? "").trim() || null;
  const smsEnabled = notificationPreferences?.sms_enabled === true;
  const smsJobAlerts =
    typeof notificationPreferences?.sms_job_alerts === "boolean"
      ? notificationPreferences.sms_job_alerts
      : typeof notificationPreferences?.sms_new_job === "boolean"
        ? notificationPreferences.sms_new_job
        : true;
  const pushEnabled = notificationPreferences?.push_enabled === true;
  const pushNewJobEnabled = notificationPreferences?.push_new_job === true;
  const expoPushToken = (profile?.expo_push_token ?? "").trim() || null;

  const shouldSendEmail = (type: string) =>
    !!email && shouldSendEmailForType(notificationPreferences, type, emailForceDisabled);

  const shouldSendSms = (type: string) =>
    !!phone && smsEnabled && SMS_NOTIFICATION_TYPES.has(type);

  const shouldSendSmsNewJob = () => !!phone && smsEnabled && smsJobAlerts;

  const shouldSendPushNewJob = () => !!expoPushToken && pushNewJobEnabled;

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

/** Get email, phone, and notification preferences for a user (server-only). Used when sending notification emails and SMS. */
export async function getNotificationPrefs(userId: string): Promise<NotificationPrefsResult> {
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

  type ProfileRow = {
    notification_preferences?: Record<string, boolean> | null;
    email_force_disabled?: boolean | null;
    phone?: string | null;
    expo_push_token?: string | null;
  };

  const admin = createSupabaseAdminClient();
  if (admin) {
    const [authRes, profileRes] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin
        .from("profiles")
        .select("notification_preferences, email_force_disabled, phone, expo_push_token")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    const email = authRes.data?.user?.email ?? null;
    return buildNotificationPrefsResult({
      email,
      profile: profileRes.data as ProfileRow | null,
    });
  }

  /**
   * Without service role we cannot read another user’s auth email. Fallback: only the
   * signed-in user (same `userId`) so local/dev misconfigs still send self-targeted tests.
   * Production must set SUPABASE_SERVICE_ROLE_KEY so lister↔cleaner notification emails work.
   */
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id !== userId || !user.email) {
    if (!loggedMissingServiceRoleForPrefs) {
      loggedMissingServiceRoleForPrefs = true;
      console.warn(
        "[getNotificationPrefs] SUPABASE_SERVICE_ROLE_KEY is missing or invalid. Transactional notification emails cannot be sent to recipients (no auth email lookup). Set SUPABASE_SERVICE_ROLE_KEY in server env (e.g. Vercel → Environment Variables). See docs/EMAIL_SETUP.md."
      );
    }
    return noSend();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_preferences, email_force_disabled, phone, expo_push_token")
    .eq("id", userId)
    .maybeSingle();

  return buildNotificationPrefsResult({
    email: user.email,
    profile: profile as ProfileRow | null,
  });
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

