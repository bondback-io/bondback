"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

function buildSafariOpenHref(httpsUrl: string): string | null {
  try {
    const u = new URL(httpsUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const scheme = u.protocol === "https:" ? "https" : "http";
    return `x-safari-${scheme}://${u.host}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

export type AuthConfirmErrorActionsProps = {
  /** Original confirmation URL (from email) so the user can open it in Safari or copy it. */
  retryUrl: string | null;
  /** When true, show Safari + copy (in-app / PKCE issues). */
  showOpenInBrowserHints: boolean;
};

/**
 * Mobile Mail / Gmail in-app browsers often break PKCE. Copy + x-safari-* gives a practical escape hatch.
 */
export function AuthConfirmErrorActions({
  retryUrl,
  showOpenInBrowserHints,
}: AuthConfirmErrorActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/i.test(navigator.userAgent));
  }, []);
  const safariHref = useMemo(
    () => (retryUrl && showOpenInBrowserHints ? buildSafariOpenHref(retryUrl) : null),
    [retryUrl, showOpenInBrowserHints]
  );

  const copy = useCallback(async () => {
    if (!retryUrl) return;
    try {
      await navigator.clipboard.writeText(retryUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }, [retryUrl]);

  if (!showOpenInBrowserHints || !retryUrl) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-sky-500/25 bg-sky-500/[0.06] px-4 py-4 dark:border-sky-500/30 dark:bg-sky-950/40">
      <p className="text-sm font-semibold text-foreground dark:text-gray-100">Finish in a full browser</p>
      <p className="text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
        Mail and Gmail in-app browsers often block the final sign-in step. Copy the link below and open it in Safari
        (iPhone) or Chrome (Android), or try the shortcut on iPhone.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {isIOS && safariHref ? (
          <Button
            asChild
            size="lg"
            className="min-h-12 w-full touch-manipulation text-base font-semibold sm:flex-1"
          >
            <a href={safariHref} rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Open in Safari
            </a>
          </Button>
        ) : null}
        <Button
          type="button"
          variant={isIOS && safariHref ? "outline" : "default"}
          size="lg"
          className="min-h-12 w-full touch-manipulation text-base font-semibold sm:flex-1"
          onClick={() => void copy()}
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              Link copied
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Copy confirmation link
            </>
          )}
        </Button>
        <Button
          asChild
          variant="ghost"
          size="lg"
          className="min-h-12 w-full touch-manipulation text-base sm:flex-1"
        >
          <a href={retryUrl} rel="noopener noreferrer" className="text-primary">
            Try this link again
          </a>
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground dark:text-gray-500">
        If a shortcut doesn&apos;t work, copy the link, open Safari or Chrome manually, paste into the address bar, then
        go.
      </p>
    </div>
  );
}
