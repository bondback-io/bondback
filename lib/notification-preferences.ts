/**
 * User-facing email notification preference keys and defaults.
 * Stored in profiles.notification_preferences (jsonb).
 */

export type NotificationPreferenceKey =
  | "email_notifications"
  | "new_bid"
  | "new_message"
  | "job_accepted"
  | "job_completed"
  | "email_after_photos"
  | "email_checklist_updates"
  | "dispute"
  | "payment_released"
  | "listing_published"
  | "receipt_emails"
  | "weekly_tips"
  | "receive_all_non_critical"
  | "email_welcome"
  | "email_tutorial"
  | "sms_enabled"
  /** Legacy; synced from sms_job_alerts on save. */
  | "sms_new_job"
  /** Cleaners: SMS when a live listing is published in range. */
  | "sms_job_alerts"
  /** Cleaners: in-app + email alerts for new listings in/near preferred area. */
  | "new_job_in_area"
  | "push_enabled"
  | "push_new_job"
  | "daily_digest"
  /** In-app bell: short chime when a new notification row arrives (Web Audio). */
  | "in_app_sound"
  /** In-app bell: short vibration on supported devices. */
  | "in_app_vibrate"
  /** In-app: new public question on my listing (Q&A Chat). */
  | "in_app_qa_new_question"
  /** In-app: lister replied to my Q&A Chat question. */
  | "in_app_qa_lister_reply";

export type NotificationPreferences = Partial<Record<NotificationPreferenceKey, boolean>>;

/** Non-spammy defaults: critical (payment, dispute) true; marketing/recurring false */
export const DEFAULT_NOTIFICATION_PREFERENCES: Record<
  NotificationPreferenceKey,
  boolean
> = {
  email_notifications: true,
  new_bid: true,
  new_message: true,
  job_accepted: true,
  job_completed: true,
  email_after_photos: true,
  email_checklist_updates: true,
  dispute: true,
  payment_released: true,
  listing_published: true,
  receipt_emails: true,
  weekly_tips: false,
  receive_all_non_critical: true,
  email_welcome: true,
  email_tutorial: true,
  sms_enabled: false,
  sms_new_job: false,
  sms_job_alerts: true,
  new_job_in_area: true,
  push_enabled: false,
  push_new_job: false,
  daily_digest: true,
  in_app_sound: true,
  in_app_vibrate: true,
  in_app_qa_new_question: true,
  in_app_qa_lister_reply: true,
};

/** Map in-app notification type to preference key for email */
export function notificationTypeToPreferenceKey(
  type: string
): NotificationPreferenceKey | null {
  switch (type) {
    case "daily_digest":
      return "daily_digest";
    case "new_bid":
      return "new_bid";
    case "new_message":
      return "new_message";
    case "job_accepted":
    case "job_approved_to_start":
    case "job_created":
      return "job_accepted";
    case "job_completed":
    case "job_cancelled_by_lister":
    case "listing_cancelled_by_lister":
      return "job_completed";
    case "dispute_opened":
    case "dispute_resolved":
      return "dispute";
    case "funds_ready":
      return "job_completed";
    case "payment_released":
    case "referral_reward":
      return "payment_released";
    case "listing_live":
      return "listing_published";
    case "early_accept_declined":
      return "job_accepted";
    case "after_photos_uploaded":
      return "email_after_photos";
    case "checklist_all_complete":
      return "email_checklist_updates";
    case "auto_release_warning":
    case "job_status_update":
      return "job_completed";
    case "new_job_in_area":
      return "new_job_in_area";
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

  if (type === "daily_digest") {
    const explicit = prefs?.daily_digest;
    return typeof explicit === "boolean"
      ? explicit
      : DEFAULT_NOTIFICATION_PREFERENCES.daily_digest;
  }

  /**
   * Payment receipts use `receipt_emails` only (not the master toggle), so users can keep
   * PDF-style receipts while turning off bell/alert emails.
   */
  if (type === "payment_receipt") {
    const explicit = prefs?.receipt_emails;
    return typeof explicit === "boolean"
      ? explicit
      : DEFAULT_NOTIFICATION_PREFERENCES.receipt_emails;
  }

  /** Master switch for transactional notification emails (digest uses `daily_digest` only). */
  if (prefs?.email_notifications === false) {
    return false;
  }

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
  email_notifications: "Receive email notifications (job updates, bids, payments & disputes)",
  new_bid: "New bid on my listing",
  new_message: "New message in a job",
  job_accepted: "Job accepted / approved to start",
  job_completed: "Job progress (marked complete, payment reminders & job status updates)",
  email_after_photos: "Email when after photos are uploaded on my jobs",
  email_checklist_updates: "Email when the checklist is fully completed",
  dispute: "Dispute opened / updated / resolved",
  payment_released: "Receive payment notifications",
  listing_published: "Listing published successfully",
  receipt_emails: "Email me payment receipts",
  weekly_tips: "Weekly tips & reminders (recurring)",
  receive_all_non_critical: "Receive all non-critical emails",
  email_welcome: "Welcome email after signup",
  email_tutorial: "Quick start guide email (24h after signup)",
  sms_enabled: "Receive SMS notifications",
  sms_new_job: "SMS for new jobs (legacy)",
  sms_job_alerts: "Receive SMS for new jobs in my area",
  new_job_in_area: "New listings in my area (in-app + email)",
  push_enabled: "Receive push notifications",
  push_new_job: "Push for new jobs",
  daily_digest: "Receive daily digest email (summary of the last 24 hours)",
  in_app_sound: "Play sound on new notifications",
  in_app_vibrate: "Vibrate on new notifications",
  in_app_qa_new_question:
    "Q&A Chat: in-app alert when someone asks a public question on my listing",
  in_app_qa_lister_reply:
    "Q&A Chat: in-app alert when the lister replies to my question",
};
