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
  const [floatingChatEnabledState, setFloatingChatEnabledState] = React.useState({
    value: initial?.floatingChatEnabled ?? true,
    saving: false,
  });
  const [enableSmsAlertsNewJobs, setEnableSmsAlertsNewJobs] = React.useState(
    initial?.enableSmsAlertsNewJobs ?? true
  );
  const [maxSmsPerUserPerDay, setMaxSmsPerUserPerDay] = React.useState<string>(
    initial?.maxSmsPerUserPerDay != null ? String(initial.maxSmsPerUserPerDay) : ""
  );
  const [maxPushPerUserPerDay, setMaxPushPerUserPerDay] = React.useState<string>(
    initial?.maxPushPerUserPerDay != null ? String(initial.maxPushPerUserPerDay) : ""
  );
  const [payoutSchedule, setPayoutSchedule] = React.useState<
    "daily" | "weekly" | "monthly"
  >(initial?.payoutSchedule ?? "weekly");

  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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
      enableSmsAlertsNewJobs,
      maxSmsPerUserPerDay: maxSmsPerUserPerDay.trim() ? Math.max(1, Math.min(20, parseInt(maxSmsPerUserPerDay, 10) || 5)) : undefined,
      maxPushPerUserPerDay: maxPushPerUserPerDay.trim() ? Math.max(1, Math.min(20, parseInt(maxPushPerUserPerDay, 10) || 5)) : undefined,
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
          <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
            Leave blank for defaults (5 SMS / 5 push). Triggers from listing publish: <code className="rounded bg-emerald-100/80 px-0.5 dark:bg-emerald-900/50">notifyNearbyCleanersOfNewListing</code>.
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
            {!emailsEnabled && (
              <Alert variant="destructive">
                <AlertDescription className="text-[11px]">
                  Email delivery is globally disabled. Users will not receive transactional or welcome emails.
                </AlertDescription>
              </Alert>
            )}
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

