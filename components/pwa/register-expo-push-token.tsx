"use client";

import { useEffect, useRef } from "react";
import { saveExpoPushToken } from "@/lib/actions/push-token";

export type RegisterExpoPushTokenProps = {
  /**
   * When provided (e.g. in Expo Go or standalone), called on mount to get the Expo push token.
   * Example: getToken={async () => (await getExpoPushTokenAsync()).data}
   */
  getToken?: () => Promise<string | null>;
};

/**
 * On app load, requests push permission and saves the Expo push token to profiles.expo_push_token.
 * Use with getToken when running in Expo (Expo Go or standalone); on web without getToken this is a no-op.
 */
export function RegisterExpoPushToken({ getToken }: RegisterExpoPushTokenProps) {
  const done = useRef(false);

  useEffect(() => {
    if (!getToken || done.current) return;
    done.current = true;
    getToken()
      .then(async (token) => {
        if (!token?.trim()) return;
        const result = await saveExpoPushToken(token.trim());
        if (!result.ok && process.env.NODE_ENV === "development") {
          console.warn("[RegisterExpoPushToken]", result.error);
        }
      })
      .catch(() => {});
  }, [getToken]);

  return null;
}
