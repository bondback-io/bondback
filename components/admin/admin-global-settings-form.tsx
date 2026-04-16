"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import type { SaveGlobalSettingsInput } from "@/lib/actions/global-settings";
import {
  saveGlobalSettings,
  setStripeTestMode,
  setFloatingChatEnabled as persistFloatingChatEnabled,
} from "@/lib/actions/global-settings";
import { sendGlobalSettingsTestEmail } from "@/lib/actions/admin-email-templates";
import { sendAdminTestNotification } from "@/lib/actions/notifications";
import { playNotificationChimeFromUserGesture } from "@/lib/notifications/notification-chime";
import { sendAdminSmsFromGlobalSettings } from "@/lib/actions/sms-notifications";
import { sendTestDailyDigestEmail } from "@/lib/actions/daily-digest";
import { sendTestAdminNotificationEmail } from "@/lib/actions/admin-notify-email";
import { sendNoBidListingRemindersManual } from "@/lib/actions/sms-notifications";
import { DEFAULT_PRICING_MODIFIERS } from "@/lib/pricing-modifiers";
import { getListingAddonLabel } from "@/lib/listing-addon-prices";

const SMS_TYPE_CONTROLS: { key: string; label: string }[] = [
  { key: "new_bid", label: "New bid" },
  { key: "job_accepted", label: "Job accepted / won" },
  { key: "job_created", label: "Job created" },
  { key: "job_approved_to_start", label: "Approved to start" },
  { key: "payment_released", label: "Payment released" },
  { key: "dispute_opened", label: "Dispute opened" },
  { key: "auto_release_warning", label: "Auto-release warning" },
  { key: "new_job_in_area", label: "New job in area (cleaners)" },
];

export type AdminGlobalSettingsFormProps = {
  initial: Partial<SaveGlobalSettingsInput> | null;
};

export function AdminGlobalSettingsForm({ initial }: AdminGlobalSettingsFormProps) {
  const [feePercentage, setFeePercentage] = React.useState(
    initial?.feePercentage ?? 12
  );
  const [requireAbn, setRequireAbn] = React.useState(
    initial?.requireAbn ?? true
  );
  const [requireStripeConnectBeforeBidding, setRequireStripeConnectBeforeBidding] =
    React.useState(initial?.requireStripeConnectBeforeBidding ?? true);
  const [minProfileCompletion, setMinProfileCompletion] = React.useState(
    initial?.minProfileCompletion ?? 70
  );
  const [autoReleaseHours, setAutoReleaseHours] = React.useState(
    initial?.autoReleaseHours ?? 48
  );
  const [emailsEnabled, setEmailsEnabled] = React.useState(
    initial?.emailsEnabled ?? true
  );
  const [announcementText, setAnnouncementText] = React.useState(
    initial?.announcementText ?? ""
  );
  const [announcementActive, setAnnouncementActive] = React.useState(
    initial?.announcementActive ?? false
  );
  const [maintenanceActive, setMaintenanceActive] = React.useState(
    initial?.maintenanceActive ?? false
  );
  const [maintenanceMessage, setMaintenanceMessage] = React.useState(
    initial?.maintenanceMessage ?? ""
  );
  const [referralEnabled, setReferralEnabled] = React.useState(
    initial?.referralEnabled ?? false
  );
  const [referralReferrerAmount, setReferralReferrerAmount] = React.useState(
    initial?.referralReferrerAmount ?? 20
  );
  const [referralReferredAmount, setReferralReferredAmount] = React.useState(
    initial?.referralReferredAmount ?? 10
  );
  const [referralMinJobAmount, setReferralMinJobAmount] = React.useState(
    initial?.referralMinJobAmount ?? 100
  );
  const [referralMaxPerUserMonth, setReferralMaxPerUserMonth] = React.useState(
    initial?.referralMaxPerUserMonth ?? 10
  );
  const [referralTermsText, setReferralTermsText] = React.useState(
    initial?.referralTermsText ?? ""
  );
  const [manualPayoutMode, setManualPayoutMode] = React.useState(
    initial?.manualPayoutMode ?? false
  );
  const [platformAbn, setPlatformAbn] = React.useState(
    initial?.platformAbn ?? ""
  );
  const [sendPaymentReceiptEmails, setSendPaymentReceiptEmails] = React.useState(
    initial?.sendPaymentReceiptEmails ?? true
  );
  const [stripeConnectEnabled, setStripeConnectEnabled] = React.useState(
    initial?.stripeConnectEnabled ?? true
  );
  const [stripeTestMode, setStripeTestModeState] = React.useState({
    value: (initial as any)?.stripeTestMode ?? true,
    saving: false,
  });
  const [allowLowAmountListings, setAllowLowAmountListings] = React.useState(
    initial?.allowLowAmountListings === true
  );
  const [allowTwoMinuteAuctionTest, setAllowTwoMinuteAuctionTest] = React.useState(
    initial?.allowTwoMinuteAuctionTest === true
  );
  const [defaultSiteTheme, setDefaultSiteTheme] = React.useState<"light" | "dark">(
    initial?.defaultSiteTheme === "light" ? "light" : "dark"
  );
  const [floatingChatEnabledState, setFloatingChatEnabledState] = React.useState({
    value: initial?.floatingChatEnabled ?? true,
    saving: false,
  });
  const [dailyDigestEnabled, setDailyDigestEnabled] = React.useState(
    initial?.dailyDigestEnabled ?? true
  );
  const [adminNotifyNewUser, setAdminNotifyNewUser] = React.useState(
    initial?.adminNotifyNewUser ?? true
  );
  const [adminNotifyNewListing, setAdminNotifyNewListing] = React.useState(
    initial?.adminNotifyNewListing ?? true
  );
  const [adminNotifyDispute, setAdminNotifyDispute] = React.useState(
    initial?.adminNotifyDispute ?? true
  );
  const [enableSmsAlertsNewJobs, setEnableSmsAlertsNewJobs] = React.useState(
    initial?.enableSmsAlertsNewJobs ?? true
  );
  const [additionalNotificationRadiusBufferKm, setAdditionalNotificationRadiusBufferKm] = React.useState(
    initial?.additionalNotificationRadiusBufferKm ?? 50
  );
  const [enableNewListingReminders, setEnableNewListingReminders] = React.useState(
    initial?.enableNewListingReminders ?? true
  );
  const [defaultCleanerChecklistItems, setDefaultCleanerChecklistItems] = React.useState<string[]>(
    initial?.defaultCleanerChecklistItems && initial.defaultCleanerChecklistItems.length > 0
      ? initial.defaultCleanerChecklistItems
      : [
          "Vacuum Apartment/House",
          "Clean all Bedrooms",
          "Clean all Bathrooms",
          "Clean Toilet",
          "Clean Kitchen",
          "Clean Laundry",
          "Mop Floors (if needed)",
        ]
  );
  const [newChecklistItemDraft, setNewChecklistItemDraft] = React.useState("");
  const [enableSmsNotifications, setEnableSmsNotifications] = React.useState(
    initial?.enableSmsNotifications ?? true
  );
  const [smsTypeEnabled, setSmsTypeEnabled] = React.useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    for (const { key } of SMS_TYPE_CONTROLS) base[key] = true;
    return { ...base, ...(initial?.smsTypeEnabled ?? {}) };
  });
  const [testSmsPending, setTestSmsPending] = React.useState(false);
  const [maxSmsPerUserPerDay, setMaxSmsPerUserPerDay] = React.useState<string>(
    initial?.maxSmsPerUserPerDay != null ? String(initial.maxSmsPerUserPerDay) : ""
  );
  const [maxPushPerUserPerDay, setMaxPushPerUserPerDay] = React.useState<string>(
    initial?.maxPushPerUserPerDay != null ? String(initial.maxPushPerUserPerDay) : ""
  );
  const [payoutSchedule, setPayoutSchedule] = React.useState<
    "daily" | "weekly" | "monthly"
  >(initial?.payoutSchedule ?? "weekly");

  const [pricingBaseRatePerBedroomAud, setPricingBaseRatePerBedroomAud] = React.useState(
    initial?.pricingBaseRatePerBedroomAud ?? DEFAULT_PRICING_MODIFIERS.baseRatePerBedroomAud
  );
  const [pricingBaseMultiplier, setPricingBaseMultiplier] = React.useState(
    initial?.pricingBaseMultiplier ?? DEFAULT_PRICING_MODIFIERS.baseMultiplier
  );
  const [pricingConditionExcellentVeryGoodPct, setPricingConditionExcellentVeryGoodPct] =
    React.useState(
      initial?.pricingConditionExcellentVeryGoodPct ??
        DEFAULT_PRICING_MODIFIERS.conditionExcellentVeryGoodPct
    );
  const [pricingConditionGoodPct, setPricingConditionGoodPct] = React.useState(
    initial?.pricingConditionGoodPct ?? DEFAULT_PRICING_MODIFIERS.conditionGoodPct
  );
  const [pricingConditionFairAveragePct, setPricingConditionFairAveragePct] = React.useState(
    initial?.pricingConditionFairAveragePct ?? DEFAULT_PRICING_MODIFIERS.conditionFairAveragePct
  );
  const [pricingConditionPoorBadPct, setPricingConditionPoorBadPct] = React.useState(
    initial?.pricingConditionPoorBadPct ?? DEFAULT_PRICING_MODIFIERS.conditionPoorBadPct
  );
  const [pricingLevelsTwoPct, setPricingLevelsTwoPct] = React.useState(
    initial?.pricingLevelsTwoPct ?? DEFAULT_PRICING_MODIFIERS.levelsTwoPct
  );
  const [pricingCarpetSteamPerBedroomAud, setPricingCarpetSteamPerBedroomAud] = React.useState(
    initial?.pricingCarpetSteamPerBedroomAud ?? DEFAULT_PRICING_MODIFIERS.carpetSteamPerBedroomAud
  );
  const [pricingWallsPerBedroomAud, setPricingWallsPerBedroomAud] = React.useState(
    initial?.pricingWallsPerBedroomAud ?? DEFAULT_PRICING_MODIFIERS.wallsPerBedroomAud
  );
  const [pricingWindowsPerBedroomAud, setPricingWindowsPerBedroomAud] = React.useState(
    initial?.pricingWindowsPerBedroomAud ?? DEFAULT_PRICING_MODIFIERS.windowsPerBedroomAud
  );
  const [pricingAddonOvenAud, setPricingAddonOvenAud] = React.useState(
    initial?.pricingAddonOvenAud ?? DEFAULT_PRICING_MODIFIERS.addonOvenAud
  );
  const [pricingAddonBalconyAud, setPricingAddonBalconyAud] = React.useState(
    initial?.pricingAddonBalconyAud ?? DEFAULT_PRICING_MODIFIERS.addonBalconyAud
  );
  const [pricingAddonGarageAud, setPricingAddonGarageAud] = React.useState(
    initial?.pricingAddonGarageAud ?? DEFAULT_PRICING_MODIFIERS.addonGarageAud
  );
  const [pricingAddonLaundryAud, setPricingAddonLaundryAud] = React.useState(
    initial?.pricingAddonLaundryAud ?? DEFAULT_PRICING_MODIFIERS.addonLaundryAud
  );
  const [pricingAddonPatioAud, setPricingAddonPatioAud] = React.useState(
    initial?.pricingAddonPatioAud ?? DEFAULT_PRICING_MODIFIERS.addonPatioAud
  );
  const [pricingAddonFridgeAud, setPricingAddonFridgeAud] = React.useState(
    initial?.pricingAddonFridgeAud ?? DEFAULT_PRICING_MODIFIERS.addonFridgeAud
  );
  const [pricingAddonBlindsAud, setPricingAddonBlindsAud] = React.useState(
    initial?.pricingAddonBlindsAud ?? DEFAULT_PRICING_MODIFIERS.addonBlindsAud
  );

  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [testEmailTo, setTestEmailTo] = React.useState("");
  const [testEmailPending, setTestEmailPending] = React.useState(false);
  const [testNotifPending, setTestNotifPending] = React.useState(false);
  const [digestTestPending, setDigestTestPending] = React.useState(false);
  const [newListingReminderPending, setNewListingReminderPending] = React.useState(false);
  const [adminTestPending, setAdminTestPending] = React.useState<
    "new_user" | "new_listing" | "dispute_opened" | null
  >(null);
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    if (initial?.floatingChatEnabled !== undefined) {
      setFloatingChatEnabledState((prev) => ({
        ...prev,
        value: initial.floatingChatEnabled as boolean,
      }));
    }
  }, [initial?.floatingChatEnabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: SaveGlobalSettingsInput = {
      feePercentage: Math.max(0, Math.min(30, Number(feePercentage) || 0)),
      requireAbn,
      requireStripeConnectBeforeBidding,
      minProfileCompletion: Math.max(
        0,
        Math.min(100, Number(minProfileCompletion) || 0)
      ),
      autoReleaseHours: Math.max(1, Number(autoReleaseHours) || 1),
      emailsEnabled,
      announcementText: announcementText,
      announcementActive,
      maintenanceActive,
      maintenanceMessage,
      referralEnabled,
      referralReferrerAmount: Math.max(
        0,
        Number(referralReferrerAmount) || 0
      ),
      referralReferredAmount: Math.max(
        0,
        Number(referralReferredAmount) || 0
      ),
      referralMinJobAmount: Math.max(
        0,
        Number(referralMinJobAmount) || 0
      ),
      referralMaxPerUserMonth: Math.max(
        0,
        Math.floor(Number(referralMaxPerUserMonth) || 0)
      ),
      referralTermsText,
      manualPayoutMode,
      platformAbn: platformAbn.trim() || undefined,
      sendPaymentReceiptEmails,
      stripeConnectEnabled,
      payoutSchedule,
      stripeTestMode: stripeTestMode.value,
      floatingChatEnabled: floatingChatEnabledState.value,
      dailyDigestEnabled,
      adminNotifyNewUser,
      adminNotifyNewListing,
      adminNotifyDispute,
      enableSmsAlertsNewJobs,
      additionalNotificationRadiusBufferKm: Math.max(
        0,
        Math.min(500, Number(additionalNotificationRadiusBufferKm) || 50)
      ),
      enableNewListingReminders,
      defaultCleanerChecklistItems: defaultCleanerChecklistItems
        .map((v) => v.trim())
        .filter((v) => v.length > 0),
      enableSmsNotifications,
      smsTypeEnabled,
      maxSmsPerUserPerDay: maxSmsPerUserPerDay.trim() ? Math.max(1, Math.min(20, parseInt(maxSmsPerUserPerDay, 10) || 5)) : undefined,
      maxPushPerUserPerDay: maxPushPerUserPerDay.trim() ? Math.max(1, Math.min(20, parseInt(maxPushPerUserPerDay, 10) || 5)) : undefined,
      pricingBaseRatePerBedroomAud: Math.max(1, Number(pricingBaseRatePerBedroomAud) || DEFAULT_PRICING_MODIFIERS.baseRatePerBedroomAud),
      pricingBaseMultiplier: Math.max(
        0.01,
        Number(pricingBaseMultiplier) || DEFAULT_PRICING_MODIFIERS.baseMultiplier
      ),
      pricingConditionExcellentVeryGoodPct: Math.max(
        0,
        Number(pricingConditionExcellentVeryGoodPct) || 0
      ),
      pricingConditionGoodPct: Math.max(0, Number(pricingConditionGoodPct) || 0),
      pricingConditionFairAveragePct: Math.max(0, Number(pricingConditionFairAveragePct) || 0),
      pricingConditionPoorBadPct: Math.max(0, Number(pricingConditionPoorBadPct) || 0),
      pricingLevelsTwoPct: Math.max(0, Number(pricingLevelsTwoPct) || 0),
      pricingCarpetSteamPerBedroomAud: Math.max(
        0,
        Number(pricingCarpetSteamPerBedroomAud) || DEFAULT_PRICING_MODIFIERS.carpetSteamPerBedroomAud
      ),
      pricingWallsPerBedroomAud: Math.max(
        0,
        Number(pricingWallsPerBedroomAud) || DEFAULT_PRICING_MODIFIERS.wallsPerBedroomAud
      ),
      pricingWindowsPerBedroomAud: Math.max(
        0,
        Number(pricingWindowsPerBedroomAud) || DEFAULT_PRICING_MODIFIERS.windowsPerBedroomAud
      ),
      pricingAddonOvenAud: Math.max(0, Number(pricingAddonOvenAud) || DEFAULT_PRICING_MODIFIERS.addonOvenAud),
      pricingAddonBalconyAud: Math.max(0, Number(pricingAddonBalconyAud) || DEFAULT_PRICING_MODIFIERS.addonBalconyAud),
      pricingAddonGarageAud: Math.max(0, Number(pricingAddonGarageAud) || DEFAULT_PRICING_MODIFIERS.addonGarageAud),
      pricingAddonLaundryAud: Math.max(0, Number(pricingAddonLaundryAud) || DEFAULT_PRICING_MODIFIERS.addonLaundryAud),
      pricingAddonPatioAud: Math.max(0, Number(pricingAddonPatioAud) || DEFAULT_PRICING_MODIFIERS.addonPatioAud),
      pricingAddonFridgeAud: Math.max(0, Number(pricingAddonFridgeAud) || DEFAULT_PRICING_MODIFIERS.addonFridgeAud),
      pricingAddonBlindsAud: Math.max(0, Number(pricingAddonBlindsAud) || DEFAULT_PRICING_MODIFIERS.addonBlindsAud),
      allowLowAmountListings,
      allowTwoMinuteAuctionTest,
      defaultSiteTheme,
    };

    startTransition(async () => {
      const result = await saveGlobalSettings(payload);
      if (!result.ok) {
        setError(result.error || "Failed to save settings.");
        return;
      }
      toast({
        title: "Global settings updated",
        description: "Platform-wide configuration has been saved.",
      });
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs sm:text-sm">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-muted-foreground dark:text-gray-400">
            Current Platform Fee:
          </span>
          <span className="text-2xl font-bold tabular-nums text-foreground dark:text-gray-100">
            {feePercentage}%
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground dark:text-gray-500">
          Lister pays this on top of job price. Cleaner receives full bid amount. Edit below.
        </p>
      </div>

      <Card className="border-border bg-card dark:border-gray-800 dark:bg-gray-950/50">
        <CardHeader>
          <CardTitle className="text-sm font-semibold dark:text-gray-100">Default site theme</CardTitle>
          <p className="text-[11px] text-muted-foreground dark:text-gray-400">
            Starting appearance for <strong>logged-out visitors</strong> and <strong>new accounts</strong> (initial{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px] dark:bg-gray-800">theme_preference</code>
            ). Anyone signed in can override in <strong>Account → Preferences</strong> (light, dark, or match device).
            Changing this does not rewrite existing users&apos; saved preferences.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="default-site-theme" className="text-xs font-medium dark:text-gray-200">
            Platform default
          </Label>
          <Select
            value={defaultSiteTheme}
            onValueChange={(v) => setDefaultSiteTheme(v === "light" ? "light" : "dark")}
          >
            <SelectTrigger id="default-site-theme" className="max-w-xs dark:border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Stripe test mode
          </CardTitle>
          <p className="text-[11px] text-amber-800/90 dark:text-amber-200/90">
            When on, test-mode banner and labels show site-wide. No real money is processed. Saves immediately when toggled.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="stripe-test-mode" className="text-xs font-medium text-amber-900 dark:text-amber-100">
              Enable Stripe Test Mode
            </Label>
            <Switch
              id="stripe-test-mode"
              checked={stripeTestMode.value}
              disabled={stripeTestMode.saving}
              onCheckedChange={async (v) => {
                const next = Boolean(v);
                setStripeTestModeState((prev) => ({ ...prev, value: next, saving: true }));
                const result = await setStripeTestMode(next);
                setStripeTestModeState((prev) => ({ ...prev, saving: false, ...(result.ok ? {} : { value: !next }) }));
                if (!result.ok) {
                  toast({ variant: "destructive", title: "Could not update Stripe test mode", description: result.error });
                } else {
                  toast({ title: "Stripe test mode updated", description: next ? "Test mode on. Banner and labels visible." : "Test mode off." });
                }
              }}
            />
            {stripeTestMode.saving && <span className="text-[11px] text-muted-foreground">Saving…</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/30">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-sky-900 dark:text-sky-100">
            New listing minimum price (testing)
          </CardTitle>
          <p className="text-[11px] text-sky-800/90 dark:text-sky-200/90">
            Normally new listings require a <strong>$100 AUD</strong> minimum starting price. Turn this on to allow
            very low amounts (e.g. <strong>$1</strong> or <strong>$0.10</strong>) for end-to-end live payment tests.
            Use only when you understand Stripe minimum charge rules. Saves with <strong>Save global settings</strong> below.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="allow-low-amount-listings" className="text-xs font-medium text-sky-900 dark:text-sky-100">
              Allow low starting prices (bypass $100 minimum)
            </Label>
            <Switch
              id="allow-low-amount-listings"
              checked={allowLowAmountListings}
              onCheckedChange={(v) => setAllowLowAmountListings(Boolean(v))}
            />
          </div>
          <p className="text-[11px] text-sky-800/80 dark:text-sky-200/80">
            <strong>2-minute auction (testing):</strong> adds a &quot;2 minutes&quot; duration next to 1 / 3 / 5 / 7 days so you can exercise
            end-of-auction and job flows without waiting a full day. Uses the same save button below.
          </p>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="allow-two-minute-auction" className="text-xs font-medium text-sky-900 dark:text-sky-100">
              Allow 2-minute auction duration on new listings
            </Label>
            <Switch
              id="allow-two-minute-auction"
              checked={allowTwoMinuteAuctionTest}
              onCheckedChange={(v) => setAllowTwoMinuteAuctionTest(Boolean(v))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/30">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-violet-900 dark:text-violet-100">
            SMS notifications (Twilio)
          </CardTitle>
          <p className="text-[11px] text-violet-800/90 dark:text-violet-200/90">
            Set <code className="rounded bg-violet-100/80 px-0.5 dark:bg-violet-900/50">TWILIO_ACCOUNT_SID</code>,{" "}
            <code className="rounded bg-violet-100/80 px-0.5 dark:bg-violet-900/50">TWILIO_AUTH_TOKEN</code>,{" "}
            <code className="rounded bg-violet-100/80 px-0.5 dark:bg-violet-900/50">TWILIO_PHONE_NUMBER</code> on the server.
            When <strong>Enable SMS globally</strong> is off, no SMS is sent (including critical transactional texts).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="enable-sms-notifications" className="text-xs font-medium text-violet-900 dark:text-violet-100">
              Enable SMS globally
            </Label>
            <Switch
              id="enable-sms-notifications"
              checked={enableSmsNotifications}
              onCheckedChange={(v) => setEnableSmsNotifications(Boolean(v))}
            />
          </div>
          <p className="text-[11px] text-violet-800/80 dark:text-violet-200/80">
            Per-type SMS (critical / high-priority). Empty toggles default to on until you save; turning a type off blocks that SMS only.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SMS_TYPE_CONTROLS.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-2 rounded-lg border border-violet-200/80 bg-white/60 px-2 py-2 dark:border-violet-800/60 dark:bg-violet-950/20"
              >
                <Label htmlFor={`sms-type-${key}`} className="text-[11px] font-normal text-violet-950 dark:text-violet-100">
                  {label}
                </Label>
                <Switch
                  id={`sms-type-${key}`}
                  checked={smsTypeEnabled[key] !== false}
                  onCheckedChange={(v) =>
                    setSmsTypeEnabled((prev) => ({ ...prev, [key]: Boolean(v) }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={testSmsPending}
              onClick={() => {
                setTestSmsPending(true);
                void (async () => {
                  try {
                    const res = await sendAdminSmsFromGlobalSettings();
                    if (res.ok) {
                      toast({
                        title: "Test SMS sent",
                        description: "Check the phone number on your admin profile.",
                      });
                    } else {
                      toast({
                        variant: "destructive",
                        title: "SMS failed",
                        description: res.error ?? "Unknown error",
                      });
                    }
                  } finally {
                    setTestSmsPending(false);
                  }
                })();
              }}
            >
              {testSmsPending ? "Sending…" : "Send test SMS"}
            </Button>
            <span className="text-[11px] text-muted-foreground dark:text-gray-400">
              Sends one message via Twilio (not counted against user daily cap).
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            New job alerts (SMS + push)
          </CardTitle>
          <p className="text-[11px] text-emerald-800/90 dark:text-emerald-200/90">
            When enabled, cleaners with the <strong>cleaner</strong> role who opted in under Settings → <em>SMS for new jobs</em> / <em>Push for new jobs</em> are notified when a new <strong>live</strong> listing is within their <code className="rounded bg-emerald-100/80 px-0.5 dark:bg-emerald-900/50">max_travel_km</code> (haversine via suburb/postcode, else postcode distance). SMS uses Twilio; push uses Expo. Per-user daily caps below.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="enable-sms-alerts-new-jobs" className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
              Enable new job alerts
            </Label>
            <Switch
              id="enable-sms-alerts-new-jobs"
              checked={enableSmsAlertsNewJobs}
              onCheckedChange={(v) => setEnableSmsAlertsNewJobs(Boolean(v))}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label htmlFor="max-sms-per-user-per-day" className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
              Max SMS per cleaner per day (optional)
            </Label>
            <Input
              id="max-sms-per-user-per-day"
              type="number"
              min={1}
              max={20}
              placeholder="5"
              value={maxSmsPerUserPerDay}
              onChange={(e) => setMaxSmsPerUserPerDay(e.target.value)}
              className="h-8 w-20 text-xs dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label htmlFor="max-push-per-user-per-day" className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
              Max push per cleaner per day (optional)
            </Label>
            <Input
              id="max-push-per-user-per-day"
              type="number"
              min={1}
              max={20}
              placeholder="5"
              value={maxPushPerUserPerDay}
              onChange={(e) => setMaxPushPerUserPerDay(e.target.value)}
              className="h-8 w-20 text-xs dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label htmlFor="additional-notification-radius-buffer-km" className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
              Additional Notification Radius Buffer (km)
            </Label>
            <Input
              id="additional-notification-radius-buffer-km"
              type="number"
              min={0}
              max={500}
              step={1}
              placeholder="50"
              value={additionalNotificationRadiusBufferKm}
              onChange={(e) => setAdditionalNotificationRadiusBufferKm(Number(e.target.value))}
              className="h-8 w-24 text-xs dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="enable-new-listing-reminders" className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
              Enable daily no-bid listing reminders
            </Label>
            <Switch
              id="enable-new-listing-reminders"
              checked={enableNewListingReminders}
              onCheckedChange={(v) => setEnableNewListingReminders(Boolean(v))}
            />
          </div>
          <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
            Leave blank for defaults (5 SMS / 5 push). Triggers from listing publish: <code className="rounded bg-emerald-100/80 px-0.5 dark:bg-emerald-900/50">notifyNearbyCleanersOfNewListing</code>.
          </p>
          <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
            Scheduled reminders run once per day (Vercel Hobby limit). Manual send below is immediate.
          </p>
          <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
            Example: cleaner preferred radius 30km + buffer 50km = outside-radius alerts up to 80km.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={newListingReminderPending}
              onClick={() => {
                setNewListingReminderPending(true);
                void sendNoBidListingRemindersManual().then((r) => {
                  setNewListingReminderPending(false);
                  if (r.ok) {
                    toast({
                      title: "Reminder run complete",
                      description: `Listings scanned: ${r.listingsConsidered}. Eligible: ${r.listingsMatched}. Notifications sent: ${r.notificationsSent}.`,
                    });
                  } else {
                    toast({
                      variant: "destructive",
                      title: "Manual reminder run failed",
                      description: r.error ?? "Unknown error",
                    });
                  }
                });
              }}
            >
              {newListingReminderPending ? "Sending…" : "Send listing reminders now"}
            </Button>
            <span className="text-[11px] text-muted-foreground dark:text-gray-400">
              Sends once immediately using live/unassigned/zero-bid filters (manual run works even if the scheduled toggle is off).
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-sm font-semibold dark:text-gray-100">
            Default cleaner checklist tasks
          </CardTitle>
          <p className="text-[11px] text-muted-foreground dark:text-gray-400">
            These are the default checklist items added when a job checklist is first created. Listers can still adjust per job.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {defaultCleanerChecklistItems.map((item, idx) => (
              <div key={`${idx}-${item}`} className="flex items-center gap-2">
                <Input
                  value={item}
                  onChange={(e) =>
                    setDefaultCleanerChecklistItems((prev) =>
                      prev.map((x, i) => (i === idx ? e.target.value : x))
                    )
                  }
                  className="h-9 text-xs dark:bg-gray-900 dark:border-gray-700"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-xs"
                  onClick={() =>
                    setDefaultCleanerChecklistItems((prev) =>
                      prev.filter((_, i) => i !== idx)
                    )
                  }
                  disabled={defaultCleanerChecklistItems.length <= 1}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newChecklistItemDraft}
              onChange={(e) => setNewChecklistItemDraft(e.target.value)}
              placeholder="Add new default checklist task..."
              className="h-9 text-xs dark:bg-gray-900 dark:border-gray-700"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => {
                const next = newChecklistItemDraft.trim();
                if (!next) return;
                setDefaultCleanerChecklistItems((prev) => [...prev, next]);
                setNewChecklistItemDraft("");
              }}
              disabled={!newChecklistItemDraft.trim()}
            >
              Add task
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-sm font-semibold dark:text-gray-100">
            Pricing modifiers
          </CardTitle>
          <p className="text-[11px] text-muted-foreground dark:text-gray-400">
            Used on <strong className="text-foreground dark:text-gray-200">New listing</strong> for the suggested base:{" "}
            <span className="font-mono text-[10px] sm:text-[11px]">
              (base rate × bedrooms) × condition × levels × base multiplier
            </span>
            , then selected add-ons (carpet steam, walls, and windows use rate × bedrooms; others are flat amounts below).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="pricing-base-rate" className="text-xs font-medium shrink-0">
              Base rate per bedroom (AUD)
            </Label>
            <Input
              id="pricing-base-rate"
              type="number"
              min={1}
              step={1}
              inputMode="decimal"
              value={pricingBaseRatePerBedroomAud}
              onChange={(e) => setPricingBaseRatePerBedroomAud(Number(e.target.value))}
              className="h-9 max-w-full sm:max-w-[8rem] sm:text-right dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="pricing-base-multiplier" className="text-xs font-medium shrink-0">
              Base multiplier
            </Label>
            <Input
              id="pricing-base-multiplier"
              type="number"
              min={0.01}
              step={0.01}
              inputMode="decimal"
              value={pricingBaseMultiplier}
              onChange={(e) => setPricingBaseMultiplier(Number(e.target.value))}
              className="h-9 max-w-full sm:max-w-[8rem] sm:text-right dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 dark:border-gray-700 dark:bg-gray-900/50">
            <p className="text-[11px] font-medium text-muted-foreground dark:text-gray-400">
              Add-ons — per bedroom (AUD each; line total = rate × bedrooms on new listing)
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="pricing-carpet-steam-pb" className="text-xs font-medium shrink-0">
                Carpet steam per bedroom
              </Label>
              <Input
                id="pricing-carpet-steam-pb"
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={pricingCarpetSteamPerBedroomAud}
                onChange={(e) => setPricingCarpetSteamPerBedroomAud(Number(e.target.value))}
                className="h-9 max-w-full sm:max-w-[8rem] sm:text-right dark:bg-gray-900 dark:border-gray-700"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="pricing-walls-pb" className="text-xs font-medium shrink-0">
                Walls per bedroom
              </Label>
              <Input
                id="pricing-walls-pb"
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={pricingWallsPerBedroomAud}
                onChange={(e) => setPricingWallsPerBedroomAud(Number(e.target.value))}
                className="h-9 max-w-full sm:max-w-[8rem] sm:text-right dark:bg-gray-900 dark:border-gray-700"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="pricing-windows-pb" className="text-xs font-medium shrink-0">
                Windows per bedroom
              </Label>
              <Input
                id="pricing-windows-pb"
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={pricingWindowsPerBedroomAud}
                onChange={(e) => setPricingWindowsPerBedroomAud(Number(e.target.value))}
                className="h-9 max-w-full sm:max-w-[8rem] sm:text-right dark:bg-gray-900 dark:border-gray-700"
              />
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 dark:border-gray-700 dark:bg-gray-900/50">
            <p className="text-[11px] font-medium text-muted-foreground dark:text-gray-400">
              Add-ons — flat (AUD per job when selected)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["oven", pricingAddonOvenAud, setPricingAddonOvenAud] as const,
                  ["balcony", pricingAddonBalconyAud, setPricingAddonBalconyAud] as const,
                  ["garage", pricingAddonGarageAud, setPricingAddonGarageAud] as const,
                  ["laundry", pricingAddonLaundryAud, setPricingAddonLaundryAud] as const,
                  ["patio", pricingAddonPatioAud, setPricingAddonPatioAud] as const,
                  ["fridge", pricingAddonFridgeAud, setPricingAddonFridgeAud] as const,
                  ["blinds", pricingAddonBlindsAud, setPricingAddonBlindsAud] as const,
                ] as const
              ).map(([key, val, setVal]) => (
                <div
                  key={key}
                  className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <Label htmlFor={`addon-flat-${key}`} className="text-xs font-medium shrink-0">
                    {getListingAddonLabel(key)}
                  </Label>
                  <Input
                    id={`addon-flat-${key}`}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="decimal"
                    value={val}
                    onChange={(e) => setVal(Number(e.target.value))}
                    className="h-9 max-w-full sm:max-w-[6rem] sm:text-right dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 dark:border-gray-700 dark:bg-gray-900/50">
            <p className="text-[11px] font-medium text-muted-foreground dark:text-gray-400">
              Condition surcharge (% added to base before levels)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-[11px] font-normal text-muted-foreground dark:text-gray-400">
                  Excellent / Very Good
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={pricingConditionExcellentVeryGoodPct}
                  onChange={(e) => setPricingConditionExcellentVeryGoodPct(Number(e.target.value))}
                  className="h-8 w-full sm:w-20 text-right text-xs dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-[11px] font-normal text-muted-foreground dark:text-gray-400">
                  Good
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={pricingConditionGoodPct}
                  onChange={(e) => setPricingConditionGoodPct(Number(e.target.value))}
                  className="h-8 w-full sm:w-20 text-right text-xs dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-[11px] font-normal text-muted-foreground dark:text-gray-400">
                  Fair / Average
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={pricingConditionFairAveragePct}
                  onChange={(e) => setPricingConditionFairAveragePct(Number(e.target.value))}
                  className="h-8 w-full sm:w-20 text-right text-xs dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-[11px] font-normal text-muted-foreground dark:text-gray-400">
                  Poor / Bad
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={pricingConditionPoorBadPct}
                  onChange={(e) => setPricingConditionPoorBadPct(Number(e.target.value))}
                  className="h-8 w-full sm:w-20 text-right text-xs dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="pricing-levels-two" className="text-xs font-medium shrink-0">
              Two levels surcharge (%)
            </Label>
            <Input
              id="pricing-levels-two"
              type="number"
              min={0}
              step={0.5}
              value={pricingLevelsTwoPct}
              onChange={(e) => setPricingLevelsTwoPct(Number(e.target.value))}
              className="h-9 max-w-full sm:max-w-[8rem] sm:text-right dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <p className="text-[11px] text-muted-foreground dark:text-gray-500">
            One level uses 0%. Percentages are applied as multipliers: 1 + (pct ÷ 100). Base multiplier scales the whole estimate (e.g. 1.05 for a 5% uplift).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Platform commission rate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground dark:text-gray-300">
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor="feePercentage"
                className="text-xs font-medium text-muted-foreground dark:text-gray-300"
              >
                Platform commission rate (%)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="feePercentage"
                  type="number"
                  min={0}
                  max={30}
                  step={0.5}
                  value={feePercentage}
                  onChange={(e) => setFeePercentage(Number(e.target.value))}
                  className="h-8 w-20 text-xs dark:bg-gray-900 dark:border-gray-700"
                />
                <span className="text-xs text-muted-foreground">% </span>
              </div>
            </div>
            <Slider
              value={[feePercentage]}
              min={0}
              max={30}
              step={0.5}
              onValueChange={([v]) => {
                // v can be undefined from Slider onValueChange
                setFeePercentage(v ?? feePercentage);
              }}
            />
            <p className="text-[11px] text-muted-foreground dark:text-gray-400">
              Charged to the lister on top of the job price. Cleaner receives the full bid amount.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Cleaner requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs sm:text-sm text-muted-foreground dark:text-gray-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                  Validate ABN with Australian Business Register (ABR)
                </Label>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                  When on, cleaner ABNs are checked against the ABR (requires ABR_GUID in .env). When off, only 11-digit format is required.
                </p>
              </div>
              <Switch
                checked={requireAbn}
                onCheckedChange={(v) => setRequireAbn(Boolean(v))}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                  Stripe Connect enabled
                </Label>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                  When on, Stripe Connect is enabled platform-wide (cleaners can connect bank and receive payouts). When off, Connect flows are disabled.
                </p>
              </div>
              <Switch
                checked={stripeConnectEnabled}
                onCheckedChange={(v) => setStripeConnectEnabled(Boolean(v))}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                  Floating chat (message icon in top nav)
                </Label>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                  When <strong>on</strong>, logged-in users see the chat icon in the header and can open the floating chat panel. When <strong>off</strong>, the chat is hidden site-wide. Saves immediately when toggled.
                </p>
              </div>
              <Switch
                checked={floatingChatEnabledState.value}
                disabled={floatingChatEnabledState.saving}
                onCheckedChange={async (v) => {
                  const next = Boolean(v);
                  setFloatingChatEnabledState((prev) => ({
                    ...prev,
                    value: next,
                    saving: true,
                  }));
                  const result = await persistFloatingChatEnabled(next);
                  if (!result.ok) {
                    setFloatingChatEnabledState((prev) => ({
                      ...prev,
                      saving: false,
                      value: !next,
                    }));
                    toast({
                      variant: "destructive",
                      title: "Could not update floating chat",
                      description: result.error,
                    });
                  } else {
                    setFloatingChatEnabledState((prev) => ({
                      ...prev,
                      saving: false,
                      value: result.floatingChatEnabled,
                    }));
                    toast({
                      title: "Floating chat updated",
                      description: result.floatingChatEnabled
                        ? "Chat icon and floating panel are visible."
                        : "Chat icon and floating panel are hidden site-wide.",
                    });
                    router.refresh();
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                  Require Stripe Connect before bidding
                </Label>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                  When on, cleaners must connect their bank account (Stripe Connect) before they can place bids.
                </p>
              </div>
              <Switch
                checked={requireStripeConnectBeforeBidding}
                onCheckedChange={(v) => setRequireStripeConnectBeforeBidding(Boolean(v))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                Default payout schedule
              </Label>
              <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                Default Stripe Connect payout frequency for cleaners who choose &quot;Follow Platform Default&quot;.
              </p>
              <Select
                value={payoutSchedule}
                onValueChange={(v) => setPayoutSchedule(v as "daily" | "weekly" | "monthly")}
              >
                <SelectTrigger className="w-full max-w-[180px] h-8 text-xs dark:bg-gray-900 dark:border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                    Minimum profile % to place bids
                  </Label>
                  <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                    Users below this completion score cannot place bids.
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={minProfileCompletion}
                  onChange={(e) => setMinProfileCompletion(Number(e.target.value))}
                  className="h-8 w-20 text-xs dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <Slider
                value={[minProfileCompletion]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) => {
                  // v can be undefined from Slider onValueChange
                  setMinProfileCompletion(v ?? minProfileCompletion);
                }}
              />
            </div>

            <div className="pt-2 flex justify-end border-t border-border dark:border-gray-700 mt-4">
              <Button
                type="submit"
                disabled={isPending}
                className="min-w-[120px]"
              >
                {isPending ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Referral Program Settings */}
      <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Referral program
            </CardTitle>
            <p className="text-[11px] text-muted-foreground dark:text-gray-400 mt-1">
              When enabled, users can share referral codes; rewards are configured below. Links to the referral system in user profiles and share flows.
            </p>
        </CardHeader>
        <CardContent className="space-y-4 text-xs sm:text-sm text-muted-foreground dark:text-gray-300">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                Referral program enabled
              </Label>
              <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                Turn on to enable referral codes and rewards across the platform.
              </p>
            </div>
            <Switch
              checked={referralEnabled}
              onCheckedChange={(v) => setReferralEnabled(Boolean(v))}
            />
          </div>

          {referralEnabled && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="referralReferrerAmount"
                  className="text-xs font-medium text-muted-foreground dark:text-gray-300"
                >
                  Credit for referrer (after first job)
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input
                    id="referralReferrerAmount"
                    type="number"
                    min={0}
                    step={1}
                    value={referralReferrerAmount}
                    onChange={(e) =>
                      setReferralReferrerAmount(Number(e.target.value))
                    }
                    className="h-8 w-24 text-xs dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                  Reward credited to the referrer after the referred user completes their
                  first qualifying job.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="referralReferredAmount"
                  className="text-xs font-medium text-muted-foreground dark:text-gray-300"
                >
                  Credit for new user (referred)
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input
                    id="referralReferredAmount"
                    type="number"
                    min={0}
                    step={1}
                    value={referralReferredAmount}
                    onChange={(e) =>
                      setReferralReferredAmount(Number(e.target.value))
                    }
                    className="h-8 w-24 text-xs dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                  Reward credited to the new user after they complete their first
                  qualifying job.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="referralMinJobAmount"
                  className="text-xs font-medium text-muted-foreground dark:text-gray-300"
                >
                  Minimum job amount to qualify
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input
                    id="referralMinJobAmount"
                    type="number"
                    min={0}
                    step={10}
                    value={referralMinJobAmount}
                    onChange={(e) =>
                      setReferralMinJobAmount(Number(e.target.value))
                    }
                    className="h-8 w-28 text-xs dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                  Only jobs with a total amount at or above this value will trigger
                  referral credits.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="referralMaxPerUserMonth"
                  className="text-xs font-medium text-muted-foreground dark:text-gray-300"
                >
                  Max referrals per user per month
                </Label>
                <Input
                  id="referralMaxPerUserMonth"
                  type="number"
                  min={0}
                  step={1}
                  value={referralMaxPerUserMonth}
                  onChange={(e) =>
                    setReferralMaxPerUserMonth(Number(e.target.value))
                  }
                  className="h-8 w-28 text-xs dark:bg-gray-900 dark:border-gray-700"
                />
                <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                  Soft cap to prevent abuse. Additional referrals in a month will not earn
                  credit.
                </p>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label
                  htmlFor="referralTermsText"
                  className="text-xs font-medium text-muted-foreground dark:text-gray-300"
                >
                  Referral terms text
                </Label>
                <Textarea
                  id="referralTermsText"
                  value={referralTermsText}
                  onChange={(e) => setReferralTermsText(e.target.value)}
                  rows={3}
                  placeholder="Refer a friend and both get credit after their first job!"
                  className="text-xs dark:bg-gray-900 dark:border-gray-700"
                />
                <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                  Shown alongside the referral share UI (e.g. in profile or share modal).
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Auto-release funds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground dark:text-gray-300">
            <Label
              htmlFor="autoReleaseHours"
              className="text-xs font-medium text-muted-foreground dark:text-gray-300"
            >
              Hours before auto-approve job completion
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="autoReleaseHours"
                type="number"
                min={1}
                value={autoReleaseHours}
                onChange={(e) => setAutoReleaseHours(Number(e.target.value))}
                className="h-8 w-24 text-xs dark:bg-gray-900 dark:border-gray-700"
              />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
            <p className="text-[11px] text-muted-foreground dark:text-gray-400">
              If the lister does not approve after the cleaner marks the job complete,
              payment is auto-captured and transferred to the cleaner after this many hours.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Manual payout mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground dark:text-gray-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                  Enable manual payout mode
                </Label>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400 mt-0.5">
                  When on, payouts may require admin approval or skip auto-release (platform-specific).
                </p>
              </div>
              <Switch
                checked={manualPayoutMode}
                onCheckedChange={setManualPayoutMode}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Payment receipt emails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground dark:text-gray-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                  Send payment receipt emails
                </Label>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400 mt-0.5">
                  When on, listers and cleaners receive receipt emails (with GST/ABN note) on release; listers receive refund receipts.
                </p>
              </div>
              <Switch
                checked={sendPaymentReceiptEmails}
                onCheckedChange={setSendPaymentReceiptEmails}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="platformAbn" className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                Platform ABN (for receipts)
              </Label>
              <Input
                id="platformAbn"
                type="text"
                placeholder="e.g. 12 345 678 901"
                value={platformAbn}
                onChange={(e) => setPlatformAbn(e.target.value.replace(/\D/g, "").slice(0, 11))}
                className="h-8 text-xs dark:bg-gray-900 dark:border-gray-700"
              />
              <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                Optional. Shown on payment receipts for tax/GST purposes.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Global email notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground dark:text-gray-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                  Enable all email notifications
                </Label>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                  When off, no emails are sent (emergency kill switch). User-level toggles:{" "}
                  <Link href="/profile" className="underline text-primary hover:opacity-90">
                    Settings → Notifications
                  </Link>
                </p>
              </div>
              <Switch
                checked={emailsEnabled}
                onCheckedChange={(v) => setEmailsEnabled(Boolean(v))}
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
              <div>
                <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                  Daily digest email
                </Label>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400 mt-0.5">
                  When on, the scheduled job can send a 24-hour summary (cleaners: new jobs nearby;
                  listers: bids &amp; jobs). Users control their own copy in Settings → Notifications.
                  Recommended schedule: 8:00 AM AEST hitting <code className="rounded bg-muted px-0.5">/api/cron/daily-digest</code> (Vercel Cron on Pro, or external scheduler; Hobby plan omits this cron in vercel.json due to deployment limits).
                </p>
              </div>
              <Switch
                checked={dailyDigestEnabled}
                onCheckedChange={(v) => setDailyDigestEnabled(Boolean(v))}
                disabled={!emailsEnabled}
              />
            </div>
            {!emailsEnabled && (
              <Alert variant="destructive">
                <AlertDescription className="text-[11px]">
                  Email delivery is globally disabled. Users will not receive transactional or welcome emails.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2 pt-2 border-t border-border mt-2">
              <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                Send a test message via Resend (uses <code className="rounded bg-muted px-0.5">RESEND_FROM</code> and{" "}
                <code className="rounded bg-muted px-0.5">RESEND_REPLY_TO</code>). Logged in <code className="rounded bg-muted px-0.5">email_logs</code>.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[180px]">
                  <Label htmlFor="global-test-email" className="text-xs text-muted-foreground">
                    Optional recipient (defaults to your account email)
                  </Label>
                  <Input
                    id="global-test-email"
                    type="email"
                    placeholder="you@example.com"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    className="h-8 text-xs mt-1 dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={testEmailPending}
                    onClick={() => {
                      setTestEmailPending(true);
                      void sendGlobalSettingsTestEmail(testEmailTo.trim() || null).then((r) => {
                        setTestEmailPending(false);
                        if (r.ok) {
                          toast({
                            title: "Test email sent",
                            description: "Check the inbox and server logs.",
                          });
                        } else {
                          toast({
                            variant: "destructive",
                            title: "Test email failed",
                            description: r.error,
                          });
                        }
                      });
                    }}
                  >
                    {testEmailPending ? "Sending…" : "Send test email"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testNotifPending}
                    onClick={() => {
                      setTestNotifPending(true);
                      void sendAdminTestNotification().then((r) => {
                        setTestNotifPending(false);
                        if (r.ok) {
                          playNotificationChimeFromUserGesture();
                          toast({
                            title: "Test notification sent",
                            description: "Check the bell icon and /notifications. No email or push is sent.",
                          });
                          router.refresh();
                        } else {
                          toast({
                            variant: "destructive",
                            title: "Test notification failed",
                            description: r.error,
                          });
                        }
                      });
                    }}
                  >
                    {testNotifPending ? "Sending…" : "Send test notification"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={digestTestPending || !emailsEnabled || !dailyDigestEnabled}
                    onClick={() => {
                      setDigestTestPending(true);
                      void sendTestDailyDigestEmail().then((r) => {
                        setDigestTestPending(false);
                        if (r.ok) {
                          toast({
                            title: "Sample digest sent",
                            description: "Check your inbox (subject starts with [Test]).",
                          });
                        } else {
                          toast({
                            variant: "destructive",
                            title: "Digest test failed",
                            description: r.error,
                          });
                        }
                      });
                    }}
                  >
                    {digestTestPending ? "Sending…" : "Send test daily digest"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Admin notifications
            </CardTitle>
            <p className="text-[11px] text-muted-foreground dark:text-gray-400 font-normal pt-0.5">
              System emails to administrators for important events. Respects{" "}
              <strong className="font-medium text-foreground/90 dark:text-gray-100">Enable all email notifications</strong>{" "}
              above. Optional env:{" "}
              <code className="rounded bg-muted px-0.5">ADMIN_NOTIFICATION_EMAIL</code> (defaults to the first admin
              account email).
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground dark:text-gray-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                  Notify admin on new user sign-up
                </Label>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400 mt-0.5">
                  Sent when a user completes their first role (onboarding), not when unlocking a second role later.
                </p>
              </div>
              <Switch
                checked={adminNotifyNewUser}
                onCheckedChange={(v) => setAdminNotifyNewUser(Boolean(v))}
                disabled={!emailsEnabled}
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
              <div>
                <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                  Notify admin on new listing created
                </Label>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400 mt-0.5">
                  When a lister publishes a new live listing.
                </p>
              </div>
              <Switch
                checked={adminNotifyNewListing}
                onCheckedChange={(v) => setAdminNotifyNewListing(Boolean(v))}
                disabled={!emailsEnabled}
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
              <div>
                <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                  Notify admin on new dispute
                </Label>
                <p className="text-[11px] text-muted-foreground dark:text-gray-400 mt-0.5">
                  When a lister or cleaner opens a dispute on a job.
                </p>
              </div>
              <Switch
                checked={adminNotifyDispute}
                onCheckedChange={(v) => setAdminNotifyDispute(Boolean(v))}
                disabled={!emailsEnabled}
              />
            </div>
            <div className="pt-3 border-t border-border/60 space-y-2">
              <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                Test sends a sample email to the admin recipient (subject prefix{" "}
                <code className="rounded bg-muted px-0.5">[Test]</code>).
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!emailsEnabled || adminTestPending !== null}
                  onClick={() => {
                    setAdminTestPending("new_user");
                    void sendTestAdminNotificationEmail("new_user").then((r) => {
                      setAdminTestPending(null);
                      if (r.ok) {
                        toast({
                          title: "Test sent",
                          description: "Check the admin inbox for the new user sample.",
                        });
                      } else {
                        toast({
                          variant: "destructive",
                          title: "Test failed",
                          description: r.error,
                        });
                      }
                    });
                  }}
                >
                  {adminTestPending === "new_user" ? "Sending…" : "Test new user"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!emailsEnabled || adminTestPending !== null}
                  onClick={() => {
                    setAdminTestPending("new_listing");
                    void sendTestAdminNotificationEmail("new_listing").then((r) => {
                      setAdminTestPending(null);
                      if (r.ok) {
                        toast({
                          title: "Test sent",
                          description: "Check the admin inbox for the new listing sample.",
                        });
                      } else {
                        toast({
                          variant: "destructive",
                          title: "Test failed",
                          description: r.error,
                        });
                      }
                    });
                  }}
                >
                  {adminTestPending === "new_listing" ? "Sending…" : "Test new listing"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!emailsEnabled || adminTestPending !== null}
                  onClick={() => {
                    setAdminTestPending("dispute_opened");
                    void sendTestAdminNotificationEmail("dispute_opened").then((r) => {
                      setAdminTestPending(null);
                      if (r.ok) {
                        toast({
                          title: "Test sent",
                          description: "Check the admin inbox for the dispute sample.",
                        });
                      } else {
                        toast({
                          variant: "destructive",
                          title: "Test failed",
                          description: r.error,
                        });
                      }
                    });
                  }}
                >
                  {adminTestPending === "dispute_opened" ? "Sending…" : "Test dispute"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Site announcement banner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground dark:text-gray-300">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                Show announcement banner
              </Label>
              <Switch
                checked={announcementActive}
                onCheckedChange={(v) => setAnnouncementActive(Boolean(v))}
              />
            </div>
            <Label
              htmlFor="announcementText"
              className="text-xs font-medium text-muted-foreground dark:text-gray-300"
            >
              Banner text (HTML allowed)
            </Label>
            <Textarea
              id="announcementText"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              rows={4}
              placeholder='<strong>Maintenance</strong>: We&apos;ll be offline tonight from 11pm–1am AEST.'
              className="text-xs dark:bg-gray-900 dark:border-gray-700"
            />
            <p className="text-[11px] text-muted-foreground dark:text-gray-400">
              Rendered at the top of all pages when active. Use sparingly for important
              announcements.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Maintenance mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground dark:text-gray-300">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-medium text-muted-foreground dark:text-gray-300">
                Enable maintenance mode
              </Label>
              <Switch
                checked={maintenanceActive}
                onCheckedChange={(v) => setMaintenanceActive(Boolean(v))}
              />
            </div>
            <Label
              htmlFor="maintenanceMessage"
              className="text-xs font-medium text-muted-foreground dark:text-gray-300"
            >
              Maintenance message
            </Label>
            <Textarea
              id="maintenanceMessage"
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              rows={4}
              placeholder="Bond Back is currently undergoing scheduled maintenance. Please check back shortly."
              className="text-xs dark:bg-gray-900 dark:border-gray-700"
            />
            {maintenanceActive && (
              <Alert variant="destructive">
                <AlertDescription className="text-[11px]">
                  When enabled, non-admin users will see a full-screen maintenance banner
                  instead of the app (once wired into layout).
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isPending}
          className="min-w-[140px]"
        >
          {isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

