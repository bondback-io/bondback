import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminBackupButton } from "@/components/admin/admin-backup-button";
import { AdminShell } from "@/components/admin/admin-shell";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

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

  return { profile };
}

export default async function AdminBackupsPage() {
  const { profile } = await requireAdmin();

  return (
    <AdminShell activeHref="/admin/settings">
      <div className="space-y-4 md:space-y-6">
        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold tracking-tight md:text-xl dark:text-gray-100">
                Backups
              </CardTitle>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                {profile.full_name ?? "Admin"} · Export snapshots for safekeeping. Platform fee, Stripe, email defaults,
                and other configuration live in{" "}
                <Link href="/admin/global-settings" className="font-medium text-foreground underline-offset-4 hover:underline dark:text-gray-200">
                  Global settings
                </Link>
                .
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Admin only
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm" className="dark:border-gray-700 dark:hover:bg-gray-800">
              <Link href="/admin/global-settings">Open Global settings →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base md:text-lg dark:text-gray-100">Backup &amp; export</CardTitle>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              Download a JSON snapshot of core tables (profiles, listings, jobs, bids, notifications) for safekeeping.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p className="max-w-xl">
              Run this regularly and store the file securely. For production, also configure automated backups in the
              Supabase Dashboard or CLI.
            </p>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <AdminBackupButton />
              <p className="text-[11px] text-muted-foreground">
                For automated backups, configure backups in the Supabase Dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
