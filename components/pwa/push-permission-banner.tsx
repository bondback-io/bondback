"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { saveExpoPushToken } from "@/lib/actions/push-token";
import { getExpoProjectId, registerExpoPushTokenAsync } from "@/lib/pwa/expo-push-register";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "bb_push_perm_banner_dismissed";

export function PushPermissionBanner({ userId }: { userId: string | null }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (!getExpoProjectId()) return;

    let cancelled = false;
    (async () => {
      try {
        const Notifications = await import("expo-notifications");
        const { status } = await Notifications.getPermissionsAsync();
        if (!cancelled && status !== "granted") setVisible(true);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId || !visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const token = await registerExpoPushTokenAsync();
      if (token) await saveExpoPushToken(token.trim());
      const Notifications = await import("expo-notifications");
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") dismiss();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Push notifications"
      className="sticky top-0 z-[60] border-b border-primary/20 bg-primary/10 px-4 py-3 dark:bg-primary/15"
    >
      <div className="container mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Stay updated on jobs &amp; messages</p>
            <p className="text-xs text-muted-foreground">
              Turn on notifications so you don&apos;t miss bids, messages, and payments.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={() => void enable()}
          >
            {busy ? "Opening…" : "Enable notifications"}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={dismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
