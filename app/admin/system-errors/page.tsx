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

function DiagnosticCard({ row }: { row: SystemErrorRow }) {
  const isError = row.severity === "error";
  const border = isError ? "border-red-500/50" : "border-amber-500/50";
  const bg = isError ? "bg-red-500/10" : "bg-amber-500/10";
  const text = isError ? "text-red-400" : "text-amber-200";

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
        </div>
      </div>

      {row.route_path ? (
        <p className="mt-2 font-mono text-xs opacity-80">route: {row.route_path}</p>
      ) : null}
      {row.listing_id ? (
        <p className="mt-1 font-mono text-xs opacity-80">listing_id: {row.listing_id}</p>
      ) : null}

      <p className="mt-4 font-mono text-sm whitespace-pre-wrap">{row.message}</p>

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

  const tableMissing =
    logError &&
    (String(logError.message).toLowerCase().includes("does not exist") ||
      String(logError.code) === "42P01");

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
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Apply <code className="rounded bg-muted px-1">supabase/sql/20260329120000_system_error_log.sql</code>{" "}
                in the Supabase SQL editor (or add it as a migration), then refresh this page.
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
