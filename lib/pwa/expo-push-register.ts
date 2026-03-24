"use client";

/**
 * Client-only: register for Expo push (mobile web / future PWA).
 * Requires NEXT_PUBLIC_EXPO_PROJECT_ID (Expo / EAS project UUID).
 */

let notificationHandlerReady = false;

export function getExpoProjectId(): string | null {
  if (typeof window === "undefined") return null;
  const id =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_EXPO_PROJECT_ID ?? process.env.EXPO_PUBLIC_PROJECT_ID)) ||
    "";
  return id.trim() || null;
}

/**
 * Requests notification permission (if needed) and returns an Expo push token, or null.
 */
export async function registerExpoPushTokenAsync(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const projectId = getExpoProjectId();
  if (!projectId) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[expo-push] Set NEXT_PUBLIC_EXPO_PROJECT_ID for Expo web push (EAS project ID)."
      );
    }
    return null;
  }

  const Notifications = await import("expo-notifications");

  if (!notificationHandlerReady) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerReady = true;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return null;

  const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenRes.data ?? null;
}
