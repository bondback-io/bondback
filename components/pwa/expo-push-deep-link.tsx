"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Cold-open from a notification: only handle once per tab load. */
let lastColdOpenHandled = false;

/**
 * When the user taps an Expo push, open the job page or Messages (for new_message).
 */
export function ExpoPushDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    let cancelled = false;

    (async () => {
      try {
        const Notifications = await import("expo-notifications");
        const go = (data: Record<string, unknown> | undefined) => {
          const jobId = typeof data?.jobId === "string" ? data.jobId : null;
          const type = typeof data?.type === "string" ? data.type : "";
          if (!jobId) return;
          if (type === "new_message") {
            router.push(`/messages?job=${encodeURIComponent(jobId)}`);
          } else {
            router.push(`/jobs/${jobId}`);
          }
        };

        const last = await Notifications.getLastNotificationResponseAsync();
        if (
          !cancelled &&
          !lastColdOpenHandled &&
          last?.notification?.request?.content?.data
        ) {
          lastColdOpenHandled = true;
          go(last.notification.request.content.data as Record<string, unknown>);
        }

        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data as Record<string, unknown> | undefined;
          go(data);
        });
      } catch {
        // expo-notifications unavailable (SSR/tests)
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [router]);

  return null;
}
