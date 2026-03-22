import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminGlobalSettingsForm } from "@/components/admin/admin-global-settings-form";
import { AdminEmailTemplates } from "@/components/admin/admin-email-templates";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getEmailTemplates } from "@/lib/actions/admin-email-templates";

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

export default async function AdminGlobalSettingsPage() {
  const { profile } = await requireAdmin();

  let existing: Awaited<ReturnType<typeof getGlobalSettings>> = null;
  let emailTemplatesData: Awaited<ReturnType<typeof getEmailTemplates>> = null;
  try {
    [existing, emailTemplatesData] = await Promise.all([
      getGlobalSettings(),
      getEmailTemplates(),
    ]);
  } catch (err) {
    console.error("[admin/global-settings] Failed to load settings:", err);
  }

  const initial = existing
    ? {
        feePercentage:
          (existing.platform_fee_percentage ?? existing.fee_percentage) ?? 12,
        requireAbn: existing.require_abn ?? true,
        requireStripeConnectBeforeBidding: existing.require_stripe_connect_before_bidding ?? true,
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
        stripeConnectEnabled: existing.stripe_connect_enabled ?? true,
        payoutSchedule: (existing.payout_schedule as "daily" | "weekly" | "monthly") ?? "weekly",
        stripeTestMode: (existing as { stripe_test_mode?: boolean }).stripe_test_mode ?? true,
        floatingChatEnabled: (existing as { floating_chat_enabled?: boolean }).floating_chat_enabled ?? true,
        enableSmsAlertsNewJobs: (existing as { enable_sms_alerts_new_jobs?: boolean }).enable_sms_alerts_new_jobs ?? true,
        maxSmsPerUserPerDay: (existing as { max_sms_per_user_per_day?: number | null }).max_sms_per_user_per_day ?? undefined,
        maxPushPerUserPerDay: (existing as { max_push_per_user_per_day?: number | null }).max_push_per_user_per_day ?? undefined,
      }
    : null;

  return (
    <AdminShell activeHref="/admin/global-settings">
      <div className="space-y-6 md:space-y-8">
        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight md:text-xl dark:text-gray-100">
                Global settings
              </CardTitle>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                {profile.full_name ?? "Admin"} · Platform-wide configuration, toggles, and email templates.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Admin only
            </Badge>
          </CardHeader>
        </Card>

        <AdminGlobalSettingsForm initial={initial} />

        <AdminEmailTemplates initial={emailTemplatesData} />
      </div>
    </AdminShell>
  );
}

