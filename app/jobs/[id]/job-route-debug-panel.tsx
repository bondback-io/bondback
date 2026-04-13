import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { JobRouteDebugPayload } from "@/lib/jobs/job-route-debug";

export type { JobRouteDebugPayload };

function interpret(payload: JobRouteDebugPayload): string {
  if (payload.userQueryError?.code === "42P17") {
    return (
      "PostgreSQL reported infinite recursion in Row Level Security on public.jobs (42P17). " +
      "That is fixed in the database by replacing cross-table EXISTS subqueries with SECURITY DEFINER helpers — " +
      "see supabase/sql/20260329180000_jobs_listings_rls_break_recursion.sql. " +
      "Open Supabase Dashboard → SQL, paste that file, and Run for this project (pushing code to GitHub does not apply SQL). " +
      "Then use supabase/sql/20260329180001_diagnose_jobs_listings_rls.sql to verify policies. " +
      "If there is still no job row for this id, use /listings/<listing-uuid> for live auctions, not /jobs/<number>."
    );
  }
  const {
    adminClientConfigured,
    adminSawJobRow,
    userSawJobRow,
    listingPublicMarketplaceVisible,
    sessionIsJobParty,
  } = payload;
  if (!adminClientConfigured) {
    if (!userSawJobRow) {
      return (
        "Service role key is not set on the server (SUPABASE_SERVICE_ROLE_KEY). The app cannot verify whether this job id exists in the database. " +
        "If RLS also blocks your user from SELECT on jobs, you will see this screen. " +
        "Set the service role env var on Vercel/hosting and redeploy."
      );
    }
    return "Service role not configured, but your user session can read this job row (RLS allows you).";
  }
  if (!adminSawJobRow) {
    return "No row in public.jobs with this id (confirmed via service role). The job was deleted or the id is wrong. Live auctions use /listings/<listing-uuid> until a job row exists.";
  }
  if (!userSawJobRow) {
    if (sessionIsJobParty === false) {
      return (
        "Job exists, but `/jobs/[id]` is only available to the listing owner and the assigned cleaner (winner). " +
        "Other users and losing bidders should use public listing browse or their own dashboard — not this job id."
      );
    }
    if (sessionIsJobParty === true) {
      return (
        "You are the lister or assigned cleaner, but RLS still blocks SELECT on public.jobs. " +
        "Ensure `jobs_select_parties` is applied (lister_id and winner_id) — see supabase/sql/20260430140000_fix_rls_auth_uid_text_casts.sql."
      );
    }
    if (listingPublicMarketplaceVisible === false) {
      return (
        "Job exists; the linked listing is not in the public marketplace slice (draft, cancelled early, or already assigned to a cleaner). " +
        "Sign in as the lister or assigned cleaner to open this job."
      );
    }
    return "Job exists (service role sees it) but your session cannot SELECT it — check RLS on public.jobs (parties + optional marketplace mirror for unassigned listings).";
  }
  return "Unexpected: your session can read the job row but the detail loader returned null — report this as a bug.";
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
      listingMarketplaceTimingVisible: payload.listingMarketplaceTimingVisible,
      listingPublicMarketplaceVisible: payload.listingPublicMarketplaceVisible,
      sessionIsJobParty: payload.sessionIsJobParty,
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
