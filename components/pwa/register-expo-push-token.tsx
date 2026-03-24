"use client";

import { useEffect, useRef } from "react";
import { saveExpoPushToken } from "@/lib/actions/push-token";
import { getExpoProjectId, registerExpoPushTokenAsync } from "@/lib/pwa/expo-push-register";

export type RegisterExpoPushTokenProps = {
  /** When set, registers push after login / session restore (mobile web + PWA). */
  userId?: string | null;
  /**
   * Optional override (e.g. Expo Go native). When omitted, web uses expo-notifications + project id.
   */
  getToken?: () => Promise<string | null>;
};

/**
 * After login, requests notification permission once and saves Expo push token to profiles.expo_push_token.
 */
export function RegisterExpoPushToken({ userId, getToken }: RegisterExpoPushTokenProps) {
  /** One registration attempt per logged-in user id (resets on logout). */
  const lastRegisteredUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      lastRegisteredUserId.current = null;
      return;
    }
    if (lastRegisteredUserId.current === userId) return;
    if (!getToken && !getExpoProjectId()) return;

    lastRegisteredUserId.current = userId;

    const run = getToken
      ? () => getToken()
      : () => registerExpoPushTokenAsync();

    run()
      .then(async (token) => {
        if (!token?.trim()) return;
        const result = await saveExpoPushToken(token.trim());
        if (!result.ok && process.env.NODE_ENV === "development") {
          console.warn("[RegisterExpoPushToken]", result.error);
        }
      })
      .catch(() => {});
  }, [userId, getToken]);

  return null;
}
