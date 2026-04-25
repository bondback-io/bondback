import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminGlobalSettingsForm } from "@/components/admin/admin-global-settings-form";
import { getGlobalSettings, normalizeListerNonresponsiveCancelIdleDays } from "@/lib/actions/global-settings";
import { parseDefaultSiteThemeFromSettings } from "@/lib/global-settings-default-theme";
import {
  DEFAULT_PRICING_MODIFIERS,
  normalizeBaseRatePerBedroomFromGlobal,
  resolvePricingModifiersFromGlobal,
} from "@/lib/pricing-modifiers";
import { parsePlatformFeePercentByServiceType } from "@/lib/platform-fee";
import { mergeServiceAddonsChecklists } from "@/lib/service-addons-checklists";
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
  try {
    existing = await getGlobalSettings();
  } catch (err) {
    console.error("[admin/global-settings] Failed to load settings:", err);
  }

  const initial = existing
    ? {
        feePercentage:
          (existing.platform_fee_percentage ?? existing.fee_percentage) ?? 12,
        platformFeePercentageByServiceType: parsePlatformFeePercentByServiceType(
          (existing as { platform_fee_percentage_by_service_type?: unknown })
            .platform_fee_percentage_by_service_type
        ),
        requireAbn: existing.require_abn ?? true,
        requireStripeConnectBeforeBidding: existing.require_stripe_connect_before_bidding ?? false,
        requireStripeConnectBeforePaymentRelease:
          (existing as { require_stripe_connect_before_payment_release?: boolean })
            .require_stripe_connect_before_payment_release !== false,
        minProfileCompletion: existing.min_profile_completion ?? 70,
        autoReleaseHours: existing.auto_release_hours ?? 48,
        listerNonresponsiveCancelIdleDays: normalizeListerNonresponsiveCancelIdleDays(
          (existing as { lister_nonresponsive_cancel_idle_days?: unknown }).lister_nonresponsive_cancel_idle_days
        ),
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
        newListingInRadiusEmail: (existing as { new_listing_in_radius_email?: boolean }).new_listing_in_radius_email !== false,
        newListingInRadiusInApp: (existing as { new_listing_in_radius_in_app?: boolean }).new_listing_in_radius_in_app !== false,
        newListingInRadiusSms:
          typeof (existing as { new_listing_in_radius_sms?: boolean }).new_listing_in_radius_sms === "boolean"
            ? Boolean((existing as { new_listing_in_radius_sms: boolean }).new_listing_in_radius_sms)
            : (existing as { enable_sms_alerts_new_jobs?: boolean }).enable_sms_alerts_new_jobs !== false,
        newListingInRadiusPush:
          typeof (existing as { new_listing_in_radius_push?: boolean }).new_listing_in_radius_push === "boolean"
            ? Boolean((existing as { new_listing_in_radius_push: boolean }).new_listing_in_radius_push)
            : (existing as { enable_sms_alerts_new_jobs?: boolean }).enable_sms_alerts_new_jobs !== false,
        newListingOutsideEmail: (existing as { new_listing_outside_email?: boolean }).new_listing_outside_email !== false,
        newListingOutsideInApp: (existing as { new_listing_outside_in_app?: boolean }).new_listing_outside_in_app !== false,
        newListingOutsideSms:
          typeof (existing as { new_listing_outside_sms?: boolean }).new_listing_outside_sms === "boolean"
            ? Boolean((existing as { new_listing_outside_sms: boolean }).new_listing_outside_sms)
            : (existing as { enable_sms_alerts_new_jobs?: boolean }).enable_sms_alerts_new_jobs !== false,
        newListingOutsidePush:
          typeof (existing as { new_listing_outside_push?: boolean }).new_listing_outside_push === "boolean"
            ? Boolean((existing as { new_listing_outside_push: boolean }).new_listing_outside_push)
            : (existing as { enable_sms_alerts_new_jobs?: boolean }).enable_sms_alerts_new_jobs !== false,
        enableDailyBrowseJobsNudge:
          (existing as { enable_daily_browse_jobs_nudge?: boolean | null }).enable_daily_browse_jobs_nudge !== false,
        additionalNotificationRadiusBufferKm:
          (existing as { additional_notification_radius_buffer_km?: number | null }).additional_notification_radius_buffer_km ?? 50,
        enableNewListingReminders:
          (existing as { enable_new_listing_reminders?: boolean | null }).enable_new_listing_reminders ?? true,
        defaultCleanerChecklistItems:
          (existing as { default_cleaner_checklist_items?: string[] | null }).default_cleaner_checklist_items ?? [
            "Vacuum Apartment/House",
            "Clean all Bedrooms",
            "Clean all Bathrooms",
            "Clean Toilet",
            "Clean Kitchen",
            "Clean Laundry",
            "Mop Floors (if needed)",
          ],
        enableSmsNotifications: (existing as { enable_sms_notifications?: boolean }).enable_sms_notifications ?? true,
        smsTypeEnabled:
          (existing as { sms_type_enabled?: Record<string, boolean> | null }).sms_type_enabled ?? {},
        maxSmsPerUserPerDay: (existing as { max_sms_per_user_per_day?: number | null }).max_sms_per_user_per_day ?? undefined,
        maxPushPerUserPerDay: (existing as { max_push_per_user_per_day?: number | null }).max_push_per_user_per_day ?? undefined,
        pricingBaseRatePerBedroomAud: normalizeBaseRatePerBedroomFromGlobal(
          (existing as { pricing_base_rate_per_bedroom_aud?: number | null }).pricing_base_rate_per_bedroom_aud
        ),
        pricingBaseRatePerBedroomByServiceType: resolvePricingModifiersFromGlobal(
          existing as Record<string, unknown>
        ).baseRatePerBedroomByServiceAud,
        pricingBaseMultiplier:
          (existing as { pricing_base_multiplier?: number | null }).pricing_base_multiplier ??
          DEFAULT_PRICING_MODIFIERS.baseMultiplier,
        pricingBaseMultiplierByServiceType: resolvePricingModifiersFromGlobal(
          existing as Record<string, unknown>
        ).baseMultiplierByService,
        pricingBathroomRatePerBathroomByServiceType: resolvePricingModifiersFromGlobal(
          existing as Record<string, unknown>
        ).bathroomRatePerBathroomByServiceAud,
        pricingConditionExcellentVeryGoodPct:
          (existing as { pricing_condition_excellent_very_good_pct?: number | null }).pricing_condition_excellent_very_good_pct ?? 0,
        pricingConditionGoodPct: (existing as { pricing_condition_good_pct?: number | null }).pricing_condition_good_pct ?? 12,
        pricingConditionFairAveragePct:
          (existing as { pricing_condition_fair_average_pct?: number | null }).pricing_condition_fair_average_pct ?? 25,
        pricingConditionPoorBadPct: (existing as { pricing_condition_poor_bad_pct?: number | null }).pricing_condition_poor_bad_pct ?? 40,
        pricingLevelsTwoPct: (existing as { pricing_levels_two_pct?: number | null }).pricing_levels_two_pct ?? 15,
        pricingCarpetSteamPerBedroomAud:
          (existing as { pricing_carpet_steam_per_bedroom_aud?: number | null }).pricing_carpet_steam_per_bedroom_aud ??
          DEFAULT_PRICING_MODIFIERS.carpetSteamPerBedroomAud,
        pricingWallsPerBedroomAud:
          (existing as { pricing_walls_per_bedroom_aud?: number | null }).pricing_walls_per_bedroom_aud ??
          DEFAULT_PRICING_MODIFIERS.wallsPerBedroomAud,
        pricingWindowsPerBedroomAud:
          (existing as { pricing_windows_per_bedroom_aud?: number | null }).pricing_windows_per_bedroom_aud ??
          DEFAULT_PRICING_MODIFIERS.windowsPerBedroomAud,
        pricingAddonOvenAud:
          (existing as { pricing_addon_oven_aud?: number | null }).pricing_addon_oven_aud ??
          DEFAULT_PRICING_MODIFIERS.addonOvenAud,
        pricingAddonBalconyAud:
          (existing as { pricing_addon_balcony_aud?: number | null }).pricing_addon_balcony_aud ??
          DEFAULT_PRICING_MODIFIERS.addonBalconyAud,
        pricingAddonGarageAud:
          (existing as { pricing_addon_garage_aud?: number | null }).pricing_addon_garage_aud ??
          DEFAULT_PRICING_MODIFIERS.addonGarageAud,
        pricingAddonLaundryAud:
          (existing as { pricing_addon_laundry_aud?: number | null }).pricing_addon_laundry_aud ??
          DEFAULT_PRICING_MODIFIERS.addonLaundryAud,
        pricingAddonPatioAud:
          (existing as { pricing_addon_patio_aud?: number | null }).pricing_addon_patio_aud ??
          DEFAULT_PRICING_MODIFIERS.addonPatioAud,
        pricingAddonFridgeAud:
          (existing as { pricing_addon_fridge_aud?: number | null }).pricing_addon_fridge_aud ??
          DEFAULT_PRICING_MODIFIERS.addonFridgeAud,
        pricingAddonBlindsAud:
          (existing as { pricing_addon_blinds_aud?: number | null }).pricing_addon_blinds_aud ??
          DEFAULT_PRICING_MODIFIERS.addonBlindsAud,
        adminNotifyNewUser: (existing as { admin_notify_new_user?: boolean }).admin_notify_new_user ?? true,
        adminNotifyNewListing:
          (existing as { admin_notify_new_listing?: boolean }).admin_notify_new_listing ?? true,
        adminNotifyDispute: (existing as { admin_notify_dispute?: boolean }).admin_notify_dispute ?? true,
        allowLowAmountListings:
          (existing as { allow_low_amount_listings?: boolean }).allow_low_amount_listings === true,
        allowTwoMinuteAuctionTest:
          (existing as { allow_two_minute_auction_test?: boolean }).allow_two_minute_auction_test === true,
        defaultSiteTheme: parseDefaultSiteThemeFromSettings(existing),
        serviceAddonsChecklists: mergeServiceAddonsChecklists(
          (existing as { service_addons_checklists?: unknown }).service_addons_checklists
        ),
      }
    : null;

  return (
    <AdminShell activeHref="/admin/global-settings">
      <div className="space-y-4 md:space-y-8">
        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between sm:pb-4">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base font-semibold tracking-tight sm:text-lg md:text-xl dark:text-gray-100">
                Global settings
              </CardTitle>
              <p className="text-xs leading-relaxed text-muted-foreground dark:text-gray-400">
                {profile.full_name ?? "Admin"} · Platform-wide configuration and toggles.
              </p>
            </div>
            <Badge variant="outline" className="w-fit shrink-0 text-[10px] uppercase tracking-wide">
              Admin only
            </Badge>
          </CardHeader>
        </Card>

        <AdminGlobalSettingsForm initial={initial} />
      </div>
    </AdminShell>
  );
}

