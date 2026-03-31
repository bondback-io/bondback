import { scheduleNotificationChime } from "@/lib/notifications/notification-chime";

export type InAppNotificationFeedbackOptions = {
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  /** Bell dropdown is open — skip feedback so the user is already focused on the list. */
  bellMenuOpen: boolean;
  /** Full notifications page is visible — skip (same intent as “center open”). */
  isNotificationsRoute: boolean;
};

/**
 * Plays optional chime + short vibration for a new in-app notification.
 * Does not change toast/query logic — call from the realtime INSERT handler only.
 */
export function triggerInAppNotificationFeedback(
  opts: InAppNotificationFeedbackOptions
): void {
  if (opts.bellMenuOpen || opts.isNotificationsRoute) return;

  if (opts.soundEnabled) {
    scheduleNotificationChime();
  }

  if (
    opts.vibrateEnabled &&
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  ) {
    try {
      navigator.vibrate(100);
    } catch {
      /* ignore unsupported */
    }
  }
}
