import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { EmailDiagnosticsData } from "@/lib/actions/admin-email-diagnostics";
import { AdminEmailDiagnosticsRefresh } from "@/components/admin/admin-email-diagnostics-refresh";

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/30 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800/50">
      <span className="text-muted-foreground dark:text-gray-400">{label}</span>
      <span className="flex items-center gap-1 font-medium">
        {ok ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Yes
          </>
        ) : (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
            No
          </>
        )}
      </span>
    </div>
  );
}

export function AdminEmailDiagnosticsCard({ data }: { data: EmailDiagnosticsData }) {
  const envHealthy =
    data.hasResendApiKey && data.hasServiceRoleKey && data.hasSupabaseUrl && data.emailsEnabledGlobally;

  return (
    <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
          <CardTitle className="text-base font-semibold dark:text-gray-100">
            Email diagnostics
          </CardTitle>
        </div>
        <AdminEmailDiagnosticsRefresh />
      </CardHeader>
      <CardContent className="space-y-4 text-xs sm:text-sm">
        <p className="text-[11px] text-muted-foreground dark:text-gray-400">
          Server environment (no secrets shown). Values are from the running deployment (e.g. Vercel). Full
          setup: repository file <code className="rounded bg-muted px-0.5">docs/EMAIL_SETUP.md</code>.
        </p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Flag ok={data.hasResendApiKey} label="RESEND_API_KEY set" />
          <Flag ok={data.hasServiceRoleKey} label="SUPABASE_SERVICE_ROLE_KEY set" />
          <Flag ok={data.hasSupabaseUrl} label="NEXT_PUBLIC_SUPABASE_URL set" />
        </div>

        <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800/40">
          <p className="text-[11px] font-medium text-muted-foreground dark:text-gray-400">
            RESEND_FROM
          </p>
          <p className="mt-0.5 break-all font-mono text-[11px] text-foreground dark:text-gray-200">
            {data.resendFromDisplay}
          </p>
          <p className="mt-2 text-[11px] font-medium text-muted-foreground dark:text-gray-400">
            NEXT_PUBLIC_APP_URL (links in emails)
          </p>
          <p className="mt-0.5 break-all font-mono text-[11px] text-foreground dark:text-gray-200">
            {data.appUrlDisplay}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground dark:text-gray-500">
            RESEND_REPLY_TO: {data.replyToSet ? "set" : "optional"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground dark:text-gray-400">Global email switch</span>
          <Badge variant={data.emailsEnabledGlobally ? "default" : "destructive"} className="text-xs">
            {data.emailsEnabledGlobally ? "On" : "Off"}
          </Badge>
        </div>

        {!envHealthy && (
          <Alert className="border-amber-500/40 bg-amber-50/80 dark:border-amber-800/50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            <AlertDescription className="text-xs text-amber-950 dark:text-amber-100">
              Fix missing env vars in Vercel (or <code className="rounded bg-muted px-0.5">.env.local</code> locally)
              and ensure Admin → Global settings → “Allow all email notifications” is on.
            </AlertDescription>
          </Alert>
        )}

        <div className="border-t border-border pt-3 dark:border-gray-700">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
            Last email failure (email_logs)
          </p>
          {!data.emailLogsReachable && (
            <p className="mt-1 text-xs text-muted-foreground">
              Could not read <code className="rounded bg-muted px-0.5">email_logs</code> (service role or table
              missing).
            </p>
          )}
          {data.emailLogsReachable && !data.lastFailure && (
            <p className="mt-1 text-xs text-muted-foreground">
              No failed rows on record. Failures in the last 24h:{" "}
              <span className="font-medium text-foreground dark:text-gray-200">{data.failedLast24h}</span>{" "}
              {data.failedLast24h === 0 ? "(all good)" : ""}
            </p>
          )}
          {data.lastFailure && (
            <div className="mt-2 space-y-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/20">
              <p className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(data.lastFailure.sent_at), { addSuffix: true })} ·{" "}
                <span className="font-mono text-foreground dark:text-gray-200">{data.lastFailure.type}</span>
              </p>
              {data.lastFailure.subject && (
                <p className="text-[11px] text-foreground dark:text-gray-200">
                  Subject: {data.lastFailure.subject}
                </p>
              )}
              {data.lastFailure.error_message && (
                <p className="break-words font-mono text-[11px] text-destructive dark:text-red-300">
                  {data.lastFailure.error_message}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">
                Failed sends in last 24h: {data.failedLast24h}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
