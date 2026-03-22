import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Activity, User, Briefcase, List, Settings } from "lucide-react";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type ActivityLogRow = {
  id: string;
  admin_id: string | null;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

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

function actionIcon(actionType: string) {
  if (actionType.includes("listing") || actionType.includes("Listing")) return <List className="h-3.5 w-3.5" />;
  if (actionType.includes("job") || actionType.includes("Job")) return <Briefcase className="h-3.5 w-3.5" />;
  if (actionType.includes("settings") || actionType.includes("global")) return <Settings className="h-3.5 w-3.5" />;
  return <Activity className="h-3.5 w-3.5" />;
}

export default async function AdminActivityLogPage() {
  const { profile, supabase } = await requireAdmin();
  const admin = createSupabaseAdminClient();
  const client = admin ?? supabase;

  const { data: logData } = await (client as any)
    .from("admin_activity_log")
    .select("id, admin_id, action_type, target_type, target_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (logData ?? []) as ActivityLogRow[];
  const adminIds = Array.from(new Set(rows.map((r) => r.admin_id).filter(Boolean))) as string[];
  const profilesMap = new Map<string, { full_name: string | null }>();
  if (adminIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", adminIds);
    (profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
      profilesMap.set(p.id, { full_name: p.full_name });
    });
  }

  return (
    <AdminShell activeHref="/admin/activity">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl dark:text-gray-100">
            Activity log
          </h1>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Audit trail of admin actions: settings changes, job and listing updates. {profile.full_name ?? "Admin"}
          </p>
        </div>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base md:text-lg dark:text-gray-100">
                Recent activity
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Last 200 events. Who did what and when.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {rows.length} rows
            </Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {rows.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground dark:text-gray-400">
                No activity logged yet. Actions from global settings, jobs, and listings are recorded here once the table exists.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="dark:border-gray-800">
                    <TableHead className="w-40">When</TableHead>
                    <TableHead className="w-48">Admin</TableHead>
                    <TableHead className="w-44">Action</TableHead>
                    <TableHead className="hidden sm:table-cell">Target</TableHead>
                    <TableHead className="hidden md:table-cell max-w-[200px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const adminName = r.admin_id ? (profilesMap.get(r.admin_id)?.full_name ?? "Admin") : "System";
                    const created = new Date(r.created_at);
                    const targetLabel =
                      r.target_type && r.target_id
                        ? `${r.target_type} ${r.target_id}`
                        : r.target_type ?? "—";
                    const targetHref =
                      r.target_type === "job" && r.target_id
                        ? `/jobs/${r.target_id}`
                        : r.target_type === "listing" && r.target_id
                          ? `/admin/listings`
                          : null;
                    const detailsStr =
                      r.details && Object.keys(r.details).length > 0
                        ? JSON.stringify(r.details)
                        : "";
                    return (
                      <TableRow key={r.id} className="dark:border-gray-800">
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(created, { addSuffix: true })}
                          <span className="block text-[10px] opacity-80">
                            {format(created, "MMM d, yyyy HH:mm")}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.admin_id ? (
                            <Link
                              href={`/admin/users/${r.admin_id}`}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <User className="h-3 w-3" />
                              {adminName}
                            </Link>
                          ) : (
                            adminName
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="inline-flex items-center gap-1">
                            {actionIcon(r.action_type)}
                            {r.action_type}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">
                          {targetHref ? (
                            <Link href={targetHref} className="text-primary hover:underline">
                              {targetLabel}
                            </Link>
                          ) : (
                            targetLabel
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[200px] truncate text-[11px] text-muted-foreground">
                          {detailsStr ? detailsStr.slice(0, 80) + (detailsStr.length > 80 ? "…" : "") : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
