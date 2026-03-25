import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, getEmailForUserId } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
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
import { ArrowLeft, User, Mail } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminUsersFetchErrorToast } from "@/components/admin/admin-users-fetch-error-toast";
import { AdminUserNotificationOverrides } from "@/components/admin/admin-user-notification-overrides";
import { AdminUserActions } from "@/components/admin/admin-user-actions";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getEffectivePayoutSchedule, formatPayoutScheduleLabel } from "@/lib/payout-schedule";
import { formatDistanceToNow, format } from "date-fns";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type EmailLogRow = Database["public"]["Tables"]["email_logs"]["Row"];

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = await params;
  const supabase = await createServerSupabaseClient();
  const supabaseAdmin = createSupabaseAdminClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/");

  const { data: viewerProfile } = supabaseAdmin
    ? await supabaseAdmin
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .maybeSingle()
    : await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .maybeSingle();

  if (!viewerProfile || !(viewerProfile as { is_admin?: boolean }).is_admin) {
    redirect("/dashboard");
  }

  const profileRes = supabaseAdmin
    ? await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()
    : await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

  const profileFetchErr = profileRes.error;
  const { data: profile } = profileRes;

  if (!profile) notFound();

  const client = (supabaseAdmin ?? supabase) as SupabaseClient<Database>;

  const p = profile as ProfileRow & {
    notification_preferences?: Record<string, boolean> | null;
    email_force_disabled?: boolean | null;
    email_preferences_locked?: boolean | null;
    is_banned?: boolean | null;
    is_deleted?: boolean | null;
    banned_at?: string | null;
    banned_reason?: string | null;
  };

  const [emailLogsData, email, globalSettings] = await Promise.all([
    client
      .from("email_logs")
      .select("id, type, sent_at, subject")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false })
      .limit(50),
    getEmailForUserId(userId),
    getGlobalSettings(),
  ]);

  const emailLogs = (emailLogsData.data ?? []) as EmailLogRow[];
  const roles = (p.roles as string[] | null) ?? [];
  const primaryRole = p.active_role ?? roles[0] ?? "—";
  const isAdmin = !!(p as { is_admin?: boolean }).is_admin;
  const isBanned = !!p.is_banned;
  const isDeleted = !!p.is_deleted;
  const isCleaner = roles.includes("cleaner");
  const stripeConnectId = (p as { stripe_connect_id?: string | null }).stripe_connect_id ?? null;
  const stripeOnboardingComplete = !!(p as { stripe_onboarding_complete?: boolean }).stripe_onboarding_complete;
  const preferredPayout = (p as { preferred_payout_schedule?: string | null }).preferred_payout_schedule ?? "platform_default";
  const platformPayout = (globalSettings?.payout_schedule as "daily" | "weekly" | "monthly") ?? "weekly";
  const effectivePayoutSchedule = formatPayoutScheduleLabel(
    getEffectivePayoutSchedule(preferredPayout as "daily" | "weekly" | "monthly" | "platform_default", platformPayout)
  );

  const detailPageFetchToast =
    !supabaseAdmin
      ? "SUPABASE_SERVICE_ROLE_KEY is not set. Add the service_role secret from Supabase → Project Settings → API and restart the dev server."
      : profileFetchErr
        ? (profileFetchErr as { message?: string }).message ?? String(profileFetchErr)
        : null;

  return (
    <AdminShell activeHref="/admin/users">
      <AdminUsersFetchErrorToast
        title={!supabaseAdmin ? "Service role key missing" : "User profile query failed"}
        description={detailPageFetchToast}
      />
      <section className="page-inner space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/users" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to users
            </Link>
          </Button>
        </div>

        {/* Profile summary */}
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {p.profile_photo_url ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border bg-muted dark:border-gray-700">
                    <Image
                      src={p.profile_photo_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-muted text-2xl font-medium text-muted-foreground dark:border-gray-700 dark:bg-gray-800">
                    {((p.full_name ?? "?")[0] ?? "?").toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight dark:text-gray-100">
                    {p.full_name ?? "Unnamed user"}
                  </h1>
                  <p className="text-sm text-muted-foreground font-mono">ID: {userId}</p>
                  {email && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {email}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant={isAdmin ? "default" : "secondary"} className="text-[10px]">
                      {primaryRole}
                    </Badge>
                    {isAdmin && (
                      <Badge variant="outline" className="text-[10px]">
                        Admin
                      </Badge>
                    )}
                    {isBanned && (
                      <Badge variant="destructive" className="text-[10px]">
                        Banned
                      </Badge>
                    )}
                    {isDeleted && (
                      <Badge variant="secondary" className="text-[10px]">
                        Deleted
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/cleaners/${userId}`} className="gap-1">
                    <User className="h-3.5 w-3.5" />
                    View profile
                  </Link>
                </Button>
                <AdminUserActions
                  user={{
                    id: userId,
                    full_name: p.full_name,
                    email,
                    is_banned: isBanned,
                    is_deleted: isDeleted,
                    roles,
                    active_role: p.active_role,
                    is_admin: isAdmin,
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="border-t border-border pt-4 dark:border-gray-800">
            <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{p.created_at ? format(new Date(p.created_at), "PPp") : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>
                  {p.updated_at
                    ? formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })
                    : "—"}
                </dd>
              </div>
              {p.suburb && (
                <div>
                  <dt className="text-muted-foreground">Location</dt>
                  <dd>
                    {p.suburb}
                    {p.postcode ? ` ${p.postcode}` : ""}
                  </dd>
                </div>
              )}
              {isBanned && p.banned_reason && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Ban reason</dt>
                  <dd className="text-amber-700 dark:text-amber-300">{p.banned_reason}</dd>
                </div>
              )}
              {isCleaner && (
                <>
                  <div>
                    <dt className="text-muted-foreground">Stripe Connect</dt>
                    <dd className="font-mono text-xs">
                      {stripeConnectId ? (
                        <span className="text-emerald-700 dark:text-emerald-400" title={stripeConnectId}>
                          {stripeConnectId.slice(0, 12)}…
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not connected</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Onboarding complete</dt>
                    <dd>
                      {stripeOnboardingComplete ? (
                        <Badge variant="default" className="text-[10px] bg-emerald-600">Yes</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">No</Badge>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Payout schedule</dt>
                    <dd>{effectivePayoutSchedule}</dd>
                  </div>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Notification preferences & admin overrides */}
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base md:text-lg dark:text-gray-100">
              Email notification preferences
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Current notification_preferences (JSON) and admin overrides.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-xs dark:bg-gray-800/50">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(p.notification_preferences ?? {}, null, 2)}
              </pre>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={p.email_force_disabled ? "destructive" : "secondary"}>
                Emails {p.email_force_disabled ? "force-disabled" : "enabled"}
              </Badge>
              {p.email_preferences_locked && (
                <Badge variant="outline">Preferences locked</Badge>
              )}
            </div>
            <AdminUserNotificationOverrides
              userId={userId}
              emailForceDisabled={!!p.email_force_disabled}
              emailPreferencesLocked={!!p.email_preferences_locked}
              currentPrefs={p.notification_preferences ?? {}}
            />
          </CardContent>
        </Card>

        {/* Email log */}
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base md:text-lg dark:text-gray-100">
              Sent email log
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Last 50 emails sent to this user.
            </p>
          </CardHeader>
          <CardContent>
            {emailLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No emails logged yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{log.type}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        {log.subject ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.sent_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}
