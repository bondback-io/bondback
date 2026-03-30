import type { NotificationPreferences } from "@/lib/notification-preferences";

/** Defaults ON when keys are missing (matches DEFAULT_NOTIFICATION_PREFERENCES). */
export function getInAppNotificationFeedbackPrefs(
  prefs: NotificationPreferences | null | undefined
): { inAppSoundEnabled: boolean; inAppVibrateEnabled: boolean } {
  return {
    inAppSoundEnabled: prefs?.in_app_sound !== false,
    inAppVibrateEnabled: prefs?.in_app_vibrate !== false,
  };
}
