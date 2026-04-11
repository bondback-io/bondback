import Link from "next/link";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminShell } from "@/components/admin/admin-shell";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type SystemErrorRow = Database["public"]["Tables"]["system_error_log"]["Row"];

/** PostgREST / Postgres wording varies ("does not exist" vs "schema cache"). */
function isMissingTableError(
  err: { message?: string; code?: string } | null,
  tableName: string
): boolean {
  if (!err) return false;
  const msg = String(err.message ?? "").toLowerCase();
  const code = String(err.code ?? "");
  const t = tableName.toLowerCase();
  if (code === "42P01") return true;
  if (msg.includes("does not exist") && msg.includes(t)) return true;
  if (msg.includes("could not find the table") && msg.includes(t)) return true;
  if (msg.includes("schema cache") && msg.includes(t)) return true;
  return false;
}

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, full_name, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = profileData as ProfileRow | null;
  if (!profile || !profile.is_admin) {
    redirect("/dashboard");
  }

  return { profile, supabase };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function DiagnosticCard({ row }: { row: SystemErrorRow }) {
  const isError = row.severity === "error";
  const border = isError ? "border-red-500/50" : "border-amber-500/50";
  const bg = isError ? "bg-red-500/10" : "bg-amber-500/10";
  const text = isError ? "text-red-400" : "text-amber-200";
  const ctx = row.context as Record<string, unknown> | null | undefined;
  const routeParam =
    ctx && typeof ctx.routeParam === "string" ? ctx.routeParam : null;
  const looksLikeListingUuidOnJobRoute =
    row.route_path === "/jobs/[id]" && routeParam != null && UUID_RE.test(routeParam);

  return (
    <div
      className={`rounded-3xl border p-6 ${border} ${bg} ${text}`}
      data-testid={`system-error-${row.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground dark:text-gray-500">
            {format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")} ·{" "}
            {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
          </p>
          <h2 className="mt-2 text-lg font-bold tracking-tight">
            {row.source}
            <Badge
              variant="outline"
              className="ml-2 border-current text-[10px] uppercase"
            >
              {row.severity}
            </Badge>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {row.job_id != null ? (
            <Button variant="outline" size="sm" asChild className="h-8 border-current/40">
              <Link href={`/jobs/${row.job_id}`}>
                Open job #{row.job_id}
                <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
              </Link>
            </Button>
          ) : null}
          {row.listing_id != null ? (
            <Button variant="outline" size="sm" asChild className="h-8 border-current/40">
              <Link href={`/listings/${encodeURIComponent(row.listing_id)}`}>
                Open listing
                <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {row.route_path ? (
        <p className="mt-2 font-mono text-xs opacity-80">route: {row.route_path}</p>
      ) : null}
      {row.listing_id ? (
        <p className="mt-1 font-mono text-xs opacity-80">listing_id: {row.listing_id}</p>
      ) : null}

      <p className="mt-4 font-mono text-sm whitespace-pre-wrap">{row.message}</p>

      {looksLikeListingUuidOnJobRoute ? (
        <div className="mt-4 rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 text-sm text-sky-100">
          <p className="font-medium text-sky-50">Likely cause: listing opened on the job URL</p>
          <p className="mt-2 text-sky-100/90">
            The path <code className="rounded bg-black/20 px-1">/jobs/[id]</code> expects a{" "}
            <strong>numeric job id</strong> (database id of the job row). A UUID-shaped id is almost
            always a <strong>listing id</strong>. Open the listing detail page instead:
          </p>
          <p className="mt-2 font-mono text-xs break-all">
            <Link
              href={`/listings/${encodeURIComponent(routeParam!)}`}
              className="text-sky-300 underline underline-offset-2 hover:text-sky-200"
            >
              /listings/{routeParam}
            </Link>
          </p>
        </div>
      ) : null}

      {(row.code || row.details || row.hint) && (
        <p className="mt-3 font-mono text-xs opacity-90">
          {row.code ? <>code: {row.code}</> : null}
          {row.details ? <> · details: {row.details}</> : null}
          {row.hint ? <> · hint: {row.hint}</> : null}
        </p>
      )}

      {row.context &&
      typeof row.context === "object" &&
      row.context !== null &&
      Object.keys(row.context as object).length > 0 ? (
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-black/20 p-3 font-mono text-[11px] leading-relaxed text-inherit opacity-95">
          {JSON.stringify(row.context, null, 2)}
        </pre>
      ) : null}

      {row.user_id ? (
        <p className="mt-3 text-xs opacity-70">user_id: {row.user_id}</p>
      ) : null}
    </div>
  );
}

export default async function AdminSystemErrorsPage() {
  const { supabase } = await requireAdmin();
  const admin = createSupabaseAdminClient();
  const client = (admin ?? supabase) as SupabaseClient<Database>;

  const { data: logData, error: logError } = await client
    .from("system_error_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const tableMissing = logError && isMissingTableError(logError, "system_error_log");

  const rows = (logData ?? []) as SystemErrorRow[];

  return (
    <AdminShell activeHref="/admin/system-errors">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl dark:text-gray-100">
            System errors
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground dark:text-gray-400">
            Latest runtime diagnostics captured from the app (e.g. job detail Supabase/RLS errors).
            Rows are written with the service role when{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            is set. Run the SQL migration if this list is empty and the table is missing.
          </p>
        </div>

        {tableMissing ? (
          <Card className="border-amber-500/40 dark:border-amber-600/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" aria-hidden />
                Table not found
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Run the SQL in <code className="rounded bg-muted px-1">docs/SYSTEM_ERROR_LOG.sql</code>{" "}
                (same as <code className="rounded bg-muted px-1">supabase/sql/20260329120000_system_error_log.sql</code>)
                in the Supabase Dashboard → SQL → New query → Run, then refresh this page.
              </p>
              <p className="text-xs">
                If you still see errors, click <strong>Reload schema</strong> under Project Settings → API
                (PostgREST schema cache can lag right after creating a table).
              </p>
            </CardContent>
          </Card>
        ) : logError ? (
          <Card className="border-red-500/40">
            <CardContent className="pt-6 text-sm text-red-600 dark:text-red-400">
              Failed to load system_error_log: {logError.message}
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No errors recorded yet. Trigger a job listing diagnostic (e.g. open a job that hits
              RLS) after the migration and service role are in place.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {rows.map((row) => (
              <DiagnosticCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
