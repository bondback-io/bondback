import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getEmailTypeLabel } from "@/lib/admin-email-templates-utils";
import { ADMIN_NOTIFICATION_LOG_PAGE_SIZE } from "@/lib/admin/admin-notification-logs-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSendTestNotificationGrid } from "@/components/admin/admin-send-test-notification-button";
import {
  AdminEmailDeliveryLogTable,
  AdminInAppDeliveryLogTable,
} from "@/components/admin/admin-notification-logs-load-more";
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

  const client = (admin ?? supabase) as SupabaseClient<Database>;

  const [
    inApp7dCountRes,
    unreadCountRes,
    emailsTodayRes,
    emails7dRes,
    emailLogsTotalRes,
    notificationsTotalRes,
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false),
    client
      .from("email_logs")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", todayStart),
    client
      .from("email_logs")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", sevenDaysAgo),
    client.from("email_logs").select("*", { count: "exact", head: true }),
    supabase.from("notifications").select("*", { count: "exact", head: true }),
  ]);

  const notificationsLast7dCount = inApp7dCountRes.count ?? 0;
  const unreadCount = unreadCountRes.count ?? 0;
  const emailsToday = emailsTodayRes.count ?? 0;
  const emailsLast7d = emails7dRes.count ?? 0;

  const emailTotalCount = emailLogsTotalRes.count ?? 0;
  const notificationsTotalCount = notificationsTotalRes.count ?? 0;

  const emailTo = ADMIN_NOTIFICATION_LOG_PAGE_SIZE - 1;
  const inAppTo = ADMIN_NOTIFICATION_LOG_PAGE_SIZE - 1;

  const [{ data: emailLogsData }, { data: notificationsData }] = await Promise.all([
    client
      .from("email_logs")
      .select("id, user_id, type, sent_at, subject")
      .order("sent_at", { ascending: false })
      .range(0, emailTo),
    supabase
      .from("notifications")
      .select("id, user_id, type, job_id, message_text, is_read, created_at")
      .order("created_at", { ascending: false })
      .range(0, inAppTo),
  ]);

  const emailLogs = (emailLogsData ?? []) as EmailLogRow[];
  const notifications = (notificationsData ?? []) as NotificationRow[];

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

  const profilesForClient = Object.fromEntries(profilesMap) as Record<
    string,
    { full_name: string | null }
  >;

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
                {notificationsLast7dCount}
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

        <Card className="border-dashed border-amber-500/30 bg-amber-50/40 dark:border-amber-800/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Notifications QA</CardTitle>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              Send sample in-app rows per type (no email/SMS/push). Check the bell and /notifications.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <AdminSendTestNotificationGrid />
          </CardContent>
        </Card>

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
                Sent notification emails — {ADMIN_NOTIFICATION_LOG_PAGE_SIZE} at a time, newest first. Use Load
                more for older entries.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {emailTotalCount} total
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <AdminEmailDeliveryLogTable
              totalCount={emailTotalCount}
              initialRows={emailLogs}
              initialProfiles={profilesForClient}
            />
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
                Notifications created in the app (bell icon) — {ADMIN_NOTIFICATION_LOG_PAGE_SIZE} at a time,
                newest first. Use Load more for older entries.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {notificationsTotalCount} total
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <AdminInAppDeliveryLogTable
              totalCount={notificationsTotalCount}
              initialRows={notifications}
              initialProfiles={profilesForClient}
            />
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
                "listing_cancelled_by_lister",
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
