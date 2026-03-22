/**
 * User-facing email notification preference keys and defaults.
 * Stored in profiles.notification_preferences (jsonb).
 */

export type NotificationPreferenceKey =
  | "new_bid"
  | "new_message"
  | "job_accepted"
  | "job_completed"
  | "dispute"
  | "payment_released"
  | "receipt_emails"
  | "weekly_tips"
  | "receive_all_non_critical"
  | "email_welcome"
  | "email_tutorial"
  | "sms_enabled"
  | "sms_new_job"
  | "push_enabled"
  | "push_new_job";

export type NotificationPreferences = Partial<Record<NotificationPreferenceKey, boolean>>;

/** Non-spammy defaults: critical (payment, dispute) true; marketing/recurring false */
export const DEFAULT_NOTIFICATION_PREFERENCES: Record<
  NotificationPreferenceKey,
  boolean
> = {
  new_bid: true,
  new_message: true,
  job_accepted: true,
  job_completed: true,
  dispute: true,
  payment_released: true,
  receipt_emails: true,
  weekly_tips: false,
  receive_all_non_critical: true,
  email_welcome: true,
  email_tutorial: true,
  sms_enabled: false,
  sms_new_job: false,
  push_enabled: false,
  push_new_job: false,
};

/** Map in-app notification type to preference key for email */
export function notificationTypeToPreferenceKey(
  type: string
): NotificationPreferenceKey | null {
  switch (type) {
    case "new_bid":
      return "new_bid";
    case "new_message":
      return "new_message";
    case "job_accepted":
    case "job_created":
      return "job_accepted";
    case "job_completed":
    case "job_cancelled_by_lister":
      return "job_completed";
    case "dispute_opened":
    case "dispute_resolved":
      return "dispute";
    case "payment_released":
    case "funds_ready":
    case "referral_reward":
      return "payment_released";
    case "payment_receipt":
      return "receipt_emails";
    case "weekly_tips":
      return "weekly_tips";
    default:
      return null;
  }
}

/** Whether this type is "critical" (always default on, user can still turn off) */
export function isCriticalNotificationType(type: string): boolean {
  const key = notificationTypeToPreferenceKey(type);
  return key === "dispute" || key === "payment_released";
}

/**
 * Resolve effective preference for a type: check force-disabled, then
 * notification_preferences[key]; receive_all_non_critical overrides for non-critical.
 */
export function shouldSendEmailForType(
  prefs: NotificationPreferences | null,
  type: string,
  emailForceDisabled: boolean
): boolean {
  if (emailForceDisabled) return false;

  const key = notificationTypeToPreferenceKey(type);
  if (!key || key === "receive_all_non_critical") return true;

  const defaultVal = DEFAULT_NOTIFICATION_PREFERENCES[key];
  const explicit = prefs?.[key];

  if (isCriticalNotificationType(type)) {
    return typeof explicit === "boolean" ? explicit : defaultVal;
  }

  if (prefs?.receive_all_non_critical === true) return true;
  return typeof explicit === "boolean" ? explicit : defaultVal;
}

export const NOTIFICATION_LABELS: Record<NotificationPreferenceKey, string> = {
  new_bid: "New bid on my listing",
  new_message: "New message in a job",
  job_accepted: "Job accepted / approved to start",
  job_completed: "Job marked complete (ready for review)",
  dispute: "Dispute opened / updated / resolved",
  payment_released: "Receive payment notifications",
  receipt_emails: "Email me payment receipts",
  weekly_tips: "Weekly tips & reminders (recurring)",
  receive_all_non_critical: "Receive all non-critical emails",
  email_welcome: "Welcome email after signup",
  email_tutorial: "Quick start guide email (24h after signup)",
  sms_enabled: "Receive SMS notifications (bids, payments, etc.)",
  sms_new_job: "SMS for new jobs",
  push_enabled: "Push notifications (bids, payments, etc.)",
  push_new_job: "Push for new jobs",
};
