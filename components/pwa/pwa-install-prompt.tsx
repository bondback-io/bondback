"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const PWA_PROMPT_DISMISSED_KEY = "pwa-prompt-dismissed";
const PWA_VISIT_COUNT_KEY = "pwa-visit-count";
/** Show install banner only after this many visits (session increments once per page load). */
const MIN_VISITS_BEFORE_PROMPT = 3;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;
  return mobileRegex.test(ua) || isSmallScreen;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<{
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  } | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowBanner(false);
    } catch {
      // User dismissed or prompt failed
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setShowBanner(false);
    try {
      sessionStorage.setItem(PWA_PROMPT_DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !isMobile()) return;

    try {
      const count = parseInt(localStorage.getItem(PWA_VISIT_COUNT_KEY) ?? "0", 10);
      localStorage.setItem(PWA_VISIT_COUNT_KEY, String(count + 1));
    } catch {
      // ignore
    }
  }, [isClient]);

  useEffect(() => {
    if (!isClient || !isMobile()) return;

    const dismissed = typeof sessionStorage !== "undefined" && sessionStorage.getItem(PWA_PROMPT_DISMISSED_KEY) === "1";
    if (dismissed) return;

    let visitCount = 0;
    try {
      visitCount = parseInt(localStorage.getItem(PWA_VISIT_COUNT_KEY) ?? "0", 10);
    } catch {
      // ignore
    }
    if (visitCount < MIN_VISITS_BEFORE_PROMPT) return;

    const handler = (e: Event) => {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;
      setDeferredPrompt({ prompt: () => ev.prompt(), userChoice: ev.userChoice });
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isClient]);

  if (!showBanner || !deferredPrompt) return null;

  return (
    <div
      role="alert"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[90] flex items-center gap-3 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "dark:border-gray-800 dark:bg-gray-900/95 dark:supports-[backdrop-filter]:dark:bg-gray-900/80",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-left text-sm">
        <p className="font-medium text-foreground dark:text-gray-100">
          Add Bond Back to your home screen for quick access!
        </p>
        <p className="text-xs text-muted-foreground dark:text-gray-400">
          Install the app for a faster experience.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={handleInstall} className="shrink-0">
          Add to Home Screen
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-gray-800 dark:hover:text-gray-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
