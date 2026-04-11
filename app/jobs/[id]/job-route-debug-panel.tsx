import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type JobRouteDebugPayload = {
  routeParam: string;
  numericJobId: number;
  sessionPresent: boolean;
  sessionUserIdPrefix: string | null;
  userSawJobRow: boolean;
  adminClientConfigured: boolean;
  adminSawJobRow: boolean;
  userQueryError: { code?: string; message?: string } | null;
  adminQueryError: { code?: string; message?: string } | null;
  listingIdFromAdmin: string | null;
};

function interpret(payload: JobRouteDebugPayload): string {
  const { adminClientConfigured, adminSawJobRow, userSawJobRow } = payload;
  if (!adminClientConfigured) {
    if (!userSawJobRow) {
      return (
        "Service role key is not set on the server (SUPABASE_SERVICE_ROLE_KEY). The app cannot verify whether this job id exists in the database. " +
        "If RLS also blocks your user from SELECT on jobs, you will see this screen. " +
        "Set the service role env var on Vercel/hosting and redeploy, or fix jobs RLS so your role can read the row."
      );
    }
    return "Service role not configured, but your user session can read this job row (RLS allows you).";
  }
  if (!adminSawJobRow) {
    return "No row in public.jobs with this id (confirmed via service role). The job was deleted or the id is wrong. Live auctions use /listings/<listing-uuid> until a job row exists.";
  }
  if (!userSawJobRow) {
    return "Job exists (service role sees it) but your session cannot SELECT it — RLS on public.jobs is blocking. Apply policies for lister_id, winner_id, or bidders (see docs/JOBS_LISTINGS_RLS_PARTY_SELECT.sql).";
  }
  return "Unexpected: both user and admin see the job row; you should not be on this debug screen.";
}

/**
 * Shown when `?debug=1` on `/jobs/[id]` and the RLS gate would otherwise call `notFound()`.
 * No secrets — only booleans, ids, and PostgREST error codes.
 */
export function JobRouteDebugPanel({ payload }: { payload: JobRouteDebugPayload }) {
  const hint = interpret(payload);
  const json = JSON.stringify(
    {
      route: `/jobs/${payload.routeParam}`,
      numericJobId: payload.numericJobId,
      sessionPresent: payload.sessionPresent,
      sessionUserIdPrefix: payload.sessionUserIdPrefix,
      userSawJobRow: payload.userSawJobRow,
      adminClientConfigured: payload.adminClientConfigured,
      adminSawJobRow: payload.adminSawJobRow,
      listingIdFromAdmin: payload.listingIdFromAdmin,
      userQueryError: payload.userQueryError,
      adminQueryError: payload.adminQueryError,
    },
    null,
    2
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Card className="border-amber-500/40 bg-amber-50/50 dark:border-amber-700/50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="text-lg text-amber-950 dark:text-amber-100">
            Job route debug (add ?debug=1)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-amber-950/90 dark:text-amber-100/90">
          <p className="leading-relaxed">{hint}</p>
          {payload.listingIdFromAdmin ? (
            <p>
              <span className="font-medium">Listing id (from job row):</span>{" "}
              <Link
                className="text-primary underline underline-offset-2"
                href={`/listings/${encodeURIComponent(payload.listingIdFromAdmin)}`}
              >
                /listings/{payload.listingIdFromAdmin.slice(0, 8)}…
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diagnostics (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[420px] overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-foreground dark:bg-gray-900/80">
            {json}
          </pre>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" asChild>
          <Link href="/jobs">Browse jobs</Link>
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href={`/jobs/${encodeURIComponent(payload.routeParam)}`}>Reload without debug</Link>
        </Button>
      </div>
    </div>
  );
}
