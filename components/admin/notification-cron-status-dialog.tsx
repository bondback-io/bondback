"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getNotificationCronStatusReport } from "@/lib/actions/notification-cron-report";
import type { NotificationCronJobReportRow } from "@/lib/actions/notification-cron-report";
import { ClipboardList, Loader2 } from "lucide-react";

function formatBrowserLocal(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "long",
    });
  } catch {
    return iso;
  }
}

function formatUtcDisplay(iso: string): string {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleString("en-GB", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }) + " (UTC)"
    );
  } catch {
    return iso;
  }
}

function JobBlock({ job }: { job: NotificationCronJobReportRow }) {
  const last = job.lastRun;
  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-left dark:border-gray-800 dark:bg-gray-900/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground dark:text-gray-100">{job.label}</p>
        <span
          className={
            last == null
              ? "text-[11px] text-muted-foreground"
              : last.ok
                ? "text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                : "text-[11px] font-medium text-red-700 dark:text-red-400"
          }
        >
          {last == null ? "No run logged yet" : last.ok ? "Last run: OK" : "Last run: failed"}
        </span>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground dark:text-gray-400">{job.description}</p>
      <dl className="grid gap-1.5 text-[11px] sm:grid-cols-1">
        <div>
          <dt className="font-medium text-foreground/80 dark:text-gray-300">API route</dt>
          <dd>
            <code className="rounded bg-muted px-1 py-0.5 text-[10px] dark:bg-gray-800">{job.apiPath}</code>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground/80 dark:text-gray-300">Vercel schedule (UTC)</dt>
          <dd className="text-muted-foreground dark:text-gray-400">
            <code className="text-[10px]">{job.cronExpressionUtc}</code> · {job.scheduleSummaryUtc}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground/80 dark:text-gray-300">Next scheduled run</dt>
          <dd className="space-y-0.5 text-muted-foreground dark:text-gray-400">
            <div>{job.nextRunUtcFormatted}</div>
            <div className="text-[10px] opacity-90">
              Your browser: {formatBrowserLocal(job.nextRunUtcIso)} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
            </div>
          </dd>
        </div>
        {last && (
          <>
            <div>
              <dt className="font-medium text-foreground/80 dark:text-gray-300">Last completed run</dt>
              <dd className="space-y-0.5 text-muted-foreground dark:text-gray-400">
                <div>{formatUtcDisplay(last.last_run_at)}</div>
                <div className="font-mono text-[10px] text-foreground/70 dark:text-gray-500">{last.last_run_at}</div>
                <div className="text-[10px]">
                  This browser: {formatBrowserLocal(last.last_run_at)} (
                  {Intl.DateTimeFormat().resolvedOptions().timeZone})
                </div>
              </dd>
            </div>
            {last.error && (
              <div>
                <dt className="font-medium text-red-800 dark:text-red-300">Error</dt>
                <dd className="whitespace-pre-wrap text-red-700 dark:text-red-400">{last.error}</dd>
              </div>
            )}
            {last.result && Object.keys(last.result).length > 0 && (
              <div>
                <dt className="font-medium text-foreground/80 dark:text-gray-300">Result snapshot</dt>
                <dd>
                  <pre className="max-h-28 overflow-auto rounded border border-border bg-background p-2 text-[10px] leading-relaxed dark:border-gray-700 dark:bg-gray-950">
                    {JSON.stringify(last.result, null, 2)}
                  </pre>
                </dd>
              </div>
            )}
          </>
        )}
      </dl>
    </div>
  );
}

export function NotificationCronStatusButton() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<{
    jobs: NotificationCronJobReportRow[];
    note: string;
  } | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    void getNotificationCronStatusReport().then((r) => {
      setLoading(false);
      if (r.ok) {
        setReport({ jobs: r.jobs, note: r.note });
      } else {
        setError(r.error);
        setReport(null);
      }
    });
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) load();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="text-xs gap-1">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden />
          Cron status report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Notification cron status</DialogTitle>
          <DialogDescription className="text-left text-xs">
            Daily jobs for no-bid reminders and browse-jobs nudge, as configured in{" "}
            <code className="rounded bg-muted px-1">vercel.json</code> (UTC). Last run is recorded when each cron
            route finishes.
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {report && !loading && (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-gray-400">{report.note}</p>
            <div className="space-y-2">
              {report.jobs.map((job) => (
                <JobBlock key={job.key} job={job} />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
