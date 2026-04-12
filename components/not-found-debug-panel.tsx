"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bug, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_PREFIX = "not-found-log:v1:";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeHint(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0] ?? "";
  const second = segments[1] ?? "";
  if (first === "jobs" && second && UUID_RE.test(second)) {
    return "This path looks like /jobs/[uuid]. Job URLs use a numeric job id; listing detail is /listings/[uuid].";
  }
  if (first === "listings" && second && /^\d+$/.test(second)) {
    return "This path looks like /listings/[number]. Listing URLs use a listing UUID; numeric ids are usually jobs → /jobs/[id].";
  }
  if (first === "jobs" && second && /^\d+$/.test(second)) {
    return "Numeric job URLs can 404 if the job id does not exist, RLS hides the row from your session, or the server cannot verify rows (e.g. missing SUPABASE_SERVICE_ROLE_KEY). Re-open this path with ?debug=1 for a server diagnostic panel.";
  }
  return null;
}

/**
 * Technical diagnostics for the global 404 page. Logs once per tab session per pathname
 * to Admin → System errors (`not_found:page_view`).
 */
export function NotFoundDebugPanel() {
  const pathname = usePathname() ?? "(unknown)";
  const [clientInfo, setClientInfo] = useState<{
    href: string;
    referrer: string;
    userAgent: string;
  } | null>(null);

  useEffect(() => {
    setClientInfo({
      href: typeof window !== "undefined" ? window.location.href : "",
      referrer: typeof document !== "undefined" ? document.referrer : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    });
  }, []);

  const hint = useMemo(() => routeHint(pathname), [pathname]);

  const payload = useMemo(() => {
    const capturedAt = new Date().toISOString();
    if (!clientInfo) {
      return {
        trigger: "not-found",
        pathname,
        href: null as string | null,
        referrer: null as string | null,
        userAgent: null as string | null,
        hint,
        capturedAt,
      };
    }
    return {
      trigger: "not-found",
      pathname,
      href: clientInfo.href || null,
      referrer: clientInfo.referrer || null,
      userAgent: clientInfo.userAgent || null,
      hint,
      capturedAt,
    };
  }, [pathname, clientInfo, hint]);

  useEffect(() => {
    if (!clientInfo) return;
    const key = STORAGE_PREFIX + pathname;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    void fetch("/api/debug/not-found-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger: "not-found",
        pathname,
        href: clientInfo.href,
        referrer: clientInfo.referrer,
        userAgent: clientInfo.userAgent,
      }),
    }).catch(() => {});
  }, [pathname, clientInfo]);

  const [copied, setCopied] = useState(false);
  const jsonStr = JSON.stringify(payload, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <details className="mt-6 w-full max-w-2xl rounded-lg border border-dashed border-muted-foreground/35 bg-muted/30 px-4 py-3 text-left dark:border-gray-700 dark:bg-gray-950/40">
      <summary className="cursor-pointer list-none font-medium text-foreground">
        <span className="inline-flex items-center gap-2">
          <Bug className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          Technical details
          <span className="text-xs font-normal text-muted-foreground">
            (also sent to Admin → System errors)
          </span>
        </span>
      </summary>
      <div className="mt-3 space-y-3 text-xs">
        <dl className="grid gap-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-[auto_1fr] sm:gap-x-3">
          <dt className="text-muted-foreground/80">pathname</dt>
          <dd className="break-all text-foreground/90">{pathname}</dd>
          <dt className="text-muted-foreground/80">full URL</dt>
          <dd className="break-all">
            {clientInfo?.href ?? "…"}
          </dd>
          <dt className="text-muted-foreground/80">referrer</dt>
          <dd className="break-all">{clientInfo?.referrer || "(none)"}</dd>
        </dl>
        {hint ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100 dark:text-amber-50">
            <strong className="font-medium">Hint:</strong> {hint}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => void copy()}>
            {copied ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Copy JSON
              </>
            )}
          </Button>
          <span className="text-[10px] text-muted-foreground">
            Source: <code className="rounded bg-muted px-1 py-0.5">not_found:page_view</code>
          </span>
        </div>
        <pre className="max-h-48 overflow-auto rounded-md bg-black/20 p-3 text-[10px] leading-relaxed text-muted-foreground dark:bg-black/40">
          {jsonStr}
        </pre>
      </div>
    </details>
  );
}
