import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminBackupButton } from "@/components/admin/admin-backup-button";
import { AdminGlobalSettingsForm } from "@/components/admin/admin-global-settings-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { getGlobalSettings } from "@/lib/actions/global-settings";

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

export default async function AdminSettingsPage() {
  const { profile } = await requireAdmin();
  const existing = await getGlobalSettings();

  const initial = existing
    ? {
        feePercentage: (existing.platform_fee_percentage ?? existing.fee_percentage) ?? 12,
        requireAbn: existing.require_abn ?? true,
        requireStripeConnectBeforeBidding: existing.require_stripe_connect_before_bidding ?? true,
        stripeConnectEnabled: existing.stripe_connect_enabled ?? true,
        stripeTestMode: existing.stripe_test_mode ?? true,
        payoutSchedule: (existing.payout_schedule as "daily" | "weekly" | "monthly") ?? "weekly",
        minProfileCompletion: existing.min_profile_completion ?? 70,
        autoReleaseHours: existing.auto_release_hours ?? 48,
        emailsEnabled: existing.emails_enabled ?? true,
        announcementText: existing.announcement_text ?? "",
        announcementActive: existing.announcement_active ?? false,
        maintenanceActive: existing.maintenance_active ?? false,
        maintenanceMessage: existing.maintenance_message ?? "",
        referralEnabled: existing.referral_enabled ?? false,
        referralReferrerAmount: existing.referral_referrer_amount ?? 20,
        referralReferredAmount: existing.referral_referred_amount ?? 10,
        referralMinJobAmount: existing.referral_min_job_amount ?? 100,
        referralMaxPerUserMonth: existing.referral_max_per_user_month ?? 10,
        referralTermsText: existing.referral_terms_text ?? "",
        manualPayoutMode: existing.manual_payout_mode ?? false,
        platformAbn: existing.platform_abn ?? "",
        sendPaymentReceiptEmails: existing.send_payment_receipt_emails ?? true,
      }
    : null;

  return (
    <AdminShell activeHref="/admin/settings">
      <div className="space-y-4 md:space-y-6">
        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight md:text-xl dark:text-gray-100">
                Settings &amp; Backups
              </CardTitle>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                {profile.full_name ?? "Admin"} · Platform-level configuration and manual backups.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Admin only
            </Badge>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base md:text-lg dark:text-gray-100">
              Backup &amp; export
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p className="max-w-xl">
              Download a JSON snapshot of core tables (profiles, listings, jobs, bids,
              notifications) for safekeeping. Run this regularly and store the file securely.
            </p>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <AdminBackupButton />
              <p className="text-[11px] text-muted-foreground">
                For automated backups, also configure backups in the Supabase Dashboard.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base md:text-lg dark:text-gray-100">
              Global settings
            </CardTitle>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              ABN requirement, platform fee, maintenance mode and email defaults. Changes are
              saved via admin-only server actions and can be audited in Activity.
            </p>
          </CardHeader>
          <CardContent>
            <AdminGlobalSettingsForm initial={initial} />
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
