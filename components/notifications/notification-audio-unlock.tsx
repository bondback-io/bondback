"use client";

import { useEffect } from "react";
import { installNotificationAudioUnlockListeners } from "@/lib/notifications/notification-chime";

/**
 * Primes Web Audio on first user gesture so in-app notification chimes can play later.
 */
export function NotificationAudioUnlock() {
  useEffect(() => {
    return installNotificationAudioUnlockListeners();
  }, []);
  return null;
}
