import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getEmailTypeLabel } from "@/lib/admin-email-templates-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminEmailDiagnosticsCard } from "@/components/admin/admin-email-diagnostics-card";
import { getEmailDiagnostics } from "@/lib/actions/admin-email-diagnostics";
import {
  Bell,
  Mail,
  Settings,
  FileText,
  ChevronRight,
  Zap,
  MessageSquare,
} from "lucide-react";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type EmailLogRow = Database["public"]["Tables"]["email_logs"]["Row"];

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

export default async function AdminNotificationsPage() {
  const { profile, supabase } = await requireAdmin();
  const admin = createSupabaseAdminClient();
  const globalSettings = await getGlobalSettings();
  const emailDiagnostics = await getEmailDiagnostics();
  const emailsEnabled = globalSettings?.emails_enabled !== false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // In-app notifications (last 100)
  const { data: notificationsData } = await supabase
    .from("notifications")
    .select("id, user_id, type, job_id, message_text, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = (notificationsData ?? []) as NotificationRow[];

  // Counts for in-app: total last 7 days, unread
  const notificationsLast7d = notifications.filter((n) => n.created_at >= sevenDaysAgo);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Email logs: use admin client so we can read all (RLS may restrict)
  const client = (admin ?? supabase) as SupabaseClient<Database>;
  const { data: emailLogsData } = await client
    .from("email_logs")
    .select("id, user_id, type, sent_at, subject")
    .order("sent_at", { ascending: false })
    .limit(150);

  const emailLogs = (emailLogsData ?? []) as EmailLogRow[];
  const emailsToday = emailLogs.filter((e) => e.sent_at >= todayStart).length;
  const emailsLast7d = emailLogs.filter((e) => e.sent_at >= sevenDaysAgo).length;

  const notificationUserIds = Array.from(new Set(notifications.map((n) => n.user_id)));
  const emailLogUserIds = Array.from(new Set(emailLogs.map((e) => e.user_id)));
  const allUserIds = Array.from(new Set([...notificationUserIds, ...emailLogUserIds]));
  const profilesMap = new Map<string, { full_name: string | null }>();
  if (allUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", allUserIds);
    (profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
      profilesMap.set(p.id, { full_name: p.full_name });
    });
  }

  return (
    <AdminShell activeHref="/admin/notifications">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl dark:text-gray-100">
            Notifications &amp; Emails
          </h1>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Monitor in-app notifications, email delivery, and manage templates. {profile.full_name ?? "Admin"}
          </p>
        </div>

        {emailDiagnostics.ok && (
          <AdminEmailDiagnosticsCard data={emailDiagnostics.data} />
        )}

        {/* Stats row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                In-app (7 days)
              </p>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums dark:text-gray-100">
                {notificationsLast7d.length}
              </p>
              <p className="text-xs text-muted-foreground">
                {unreadCount} unread
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Emails today
              </p>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums dark:text-gray-100">
                {emailsToday}
              </p>
              <p className="text-xs text-muted-foreground">
                Sent via Resend
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Emails (7 days)
              </p>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums dark:text-gray-100">
                {emailsLast7d}
              </p>
              <p className="text-xs text-muted-foreground">
                Logged in email_logs
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Global emails
              </p>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge
                variant={emailsEnabled ? "default" : "outline"}
                className="text-xs"
              >
                {emailsEnabled ? "On" : "Off"}
              </Badge>
              <p className="mt-1 text-xs text-muted-foreground">
                Kill switch in settings
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Quick actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/admin/emails">
                <FileText className="h-3.5 w-3.5" />
                Email templates &amp; toggles
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/admin/global-settings">
                <Settings className="h-3.5 w-3.5" />
                Global settings
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Email delivery log */}
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base md:text-lg dark:text-gray-100">
                Email delivery log
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Sent notification emails (last 150). Subject and type per recipient.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {emailLogs.length} rows
            </Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {emailLogs.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground dark:text-gray-400">
                No emails logged yet. Emails are recorded when sent via the notification system.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="dark:border-gray-800">
                    <TableHead>Recipient</TableHead>
                    <TableHead className="w-36">Type</TableHead>
                    <TableHead className="hidden md:table-cell max-w-[240px]">Subject</TableHead>
                    <TableHead className="w-36 text-right">Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((e) => {
                    const user = profilesMap.get(e.user_id) ?? null;
                    const sentAt = new Date(e.sent_at);
                    return (
                      <TableRow key={e.id} className="dark:border-gray-800">
                        <TableCell className="text-xs sm:text-sm">
                          <Link
                            href={`/admin/users/${e.user_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {user?.full_name ?? "User"}
                          </Link>
                          <span className="block truncate max-w-[120px] text-[11px] text-muted-foreground">
                            {e.user_id}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getEmailTypeLabel(e.type)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[240px] truncate text-xs text-muted-foreground">
                          {e.subject ?? "—"}
                        </TableCell>
                        <TableCell className="w-36 text-right text-[11px] text-muted-foreground">
                          {formatDistanceToNow(sentAt, { addSuffix: true })}
                          <span className="block text-[10px] opacity-80">
                            {format(sentAt, "MMM d, HH:mm")}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* In-app delivery log */}
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base md:text-lg dark:text-gray-100">
                In-app delivery log
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Notifications created in the app (bell icon). Last 100.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {notifications.length} rows
            </Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground dark:text-gray-400">
                No in-app notifications yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="dark:border-gray-800">
                    <TableHead>User</TableHead>
                    <TableHead className="w-40">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Message</TableHead>
                    <TableHead className="hidden sm:table-cell w-20">Job</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="w-36 text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((n) => {
                    const user = profilesMap.get(n.user_id) ?? null;
                    const created = new Date(n.created_at);
                    const timeAgo = formatDistanceToNow(created, { addSuffix: true });
                    return (
                      <TableRow key={n.id} className="dark:border-gray-800">
                        <TableCell className="text-xs sm:text-sm">
                          <Link
                            href={`/admin/users/${n.user_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {user?.full_name ?? "User"}
                          </Link>
                          <span className="block truncate max-w-[120px] text-[11px] text-muted-foreground">
                            {n.user_id}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getEmailTypeLabel(n.type)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-xs truncate text-xs text-muted-foreground">
                          {n.message_text ?? "—"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">
                          {n.job_id ? (
                            <Link
                              href={`/jobs/${n.job_id}`}
                              className="text-primary hover:underline"
                            >
                              #{n.job_id}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={n.is_read ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {n.is_read ? "Read" : "Unread"}
                          </Badge>
                        </TableCell>
                        <TableCell className="w-36 text-right text-[11px] text-muted-foreground">
                          {timeAgo}
                          <span className="block text-[10px] opacity-80">
                            {format(created, "MMM d, HH:mm")}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Type reference */}
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Notification types
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              In-app and email types used across the platform. Configure per-type toggles and templates under Email templates.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1.5 text-xs sm:grid-cols-2 md:grid-cols-3">
              {[
                "new_bid",
                "new_message",
                "job_created",
                "job_accepted",
                "job_completed",
                "job_cancelled_by_lister",
                "payment_released",
                "funds_ready",
                "dispute_opened",
                "dispute_resolved",
                "listing_live",
                "after_photos_uploaded",
                "auto_release_warning",
                "checklist_all_complete",
                "new_job_in_area",
                "job_status_update",
              ].map((type) => (
                <li key={type} className="flex items-center gap-2 rounded border border-border/60 bg-muted/30 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-800/50">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">{type}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{getEmailTypeLabel(type)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
