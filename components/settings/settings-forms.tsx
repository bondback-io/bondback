"use client";

import { useTransition, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAbnAutoSaveOnValid } from "@/hooks/use-abn-auto-save-on-valid";
import { Input } from "@/components/ui/input";
import { useAbnLiveValidation } from "@/hooks/use-abn-live-validation";
import {
  AbnValidationInputRow,
  AbnLiveValidationMessages,
} from "@/components/features/abn-validation-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { showAppErrorToast } from "@/components/errors/show-app-error-toast";
import { logClientError } from "@/lib/errors/log-client-error";
import { retryWithBackoffResult } from "@/lib/errors/retry-with-backoff";
import {
  saveProfileSettings,
  saveNotificationSettings,
  savePrivacySettings,
  changePassword,
} from "@/app/settings/actions";
import { AlertTriangle } from "lucide-react";
import { FormSavingOverlay } from "@/components/ui/form-saving-overlay";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_LABELS,
  type NotificationPreferenceKey,
} from "@/lib/notification-preferences";
import {
  primeNotificationAudioFromUserGesture,
  testNotificationChime,
} from "@/lib/notifications/notification-chime";

type ProfileSnapshot = {
  full_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  suburb: string | null;
  postcode: string | null;
  bio: string | null;
  /** Present for cleaners; same as profiles.abn, used in Settings and Profile. */
  abn?: string | null;
  /** When true, show ABN field (cleaner-only). */
  isCleaner?: boolean;
};

type NotificationPrefs = Record<string, boolean> | null;

export function SettingsProfileForm({ profile }: { profile: ProfileSnapshot }) {
  const [, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [abnValue, setAbnValue] = useState(() =>
    (profile?.abn ?? "").replace(/\D/g, "").slice(0, 11)
  );
  const abnLiveValidation = useAbnLiveValidation(profile?.isCleaner ? abnValue : "");

  useAbnAutoSaveOnValid({
    enabled: !!profile?.isCleaner,
    abnRaw: abnValue,
    validation: abnLiveValidation,
    storedAbn: profile?.abn,
  });

  return (
    <form
      className="relative space-y-4 text-foreground dark:text-gray-100"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        startTransition(() => setIsSaving(true));
        void (async () => {
          try {
            const result = await retryWithBackoffResult(
              () => saveProfileSettings(formData),
              { scope: "settings.profile", maxAttempts: 3 }
            );
            if (result.ok) {
              toast({
                title: "Settings saved successfully",
                description: "Your profile has been updated.",
              });
            } else {
              logClientError("settings.profile", result.error);
              showAppErrorToast(toast, {
                flow: "settings",
                error: new Error(result.error ?? ""),
                context: "settings.profile",
              });
            }
          } finally {
            setIsSaving(false);
          }
        })();
      }}
    >
      <FormSavingOverlay
        show={isSaving}
        variant="card"
        title="Saving profile…"
        description="Updating your details — almost done."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-muted-foreground dark:text-gray-300">
            Full name
          </Label>
          <Input
            id="full_name"
            name="full_name"
            defaultValue={profile?.full_name ?? ""}
            placeholder="Your full name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-muted-foreground dark:text-gray-300">
            Phone
          </Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={profile?.phone ?? ""}
            placeholder="Mobile number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_of_birth" className="text-muted-foreground dark:text-gray-300">
            Date of birth (optional)
          </Label>
          <Input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            defaultValue={profile?.date_of_birth ?? ""}
          />
          <p className="text-base text-muted-foreground dark:text-gray-500 md:text-[11px]">
            Used for birthday wishes from Bond Back. We don’t share this.
          </p>
        </div>
      </div>
      {profile?.isCleaner && (
        <div className="space-y-2">
          <Label htmlFor="abn" className="text-muted-foreground dark:text-gray-300">
            ABN (11 digits)
          </Label>
          <AbnValidationInputRow
            id="abn"
            name="abn"
            value={abnValue}
            onChange={(e) =>
              setAbnValue(e.target.value.replace(/\D/g, "").slice(0, 11))
            }
            placeholder="e.g. 12345678901"
            maxLength={11}
            inputMode="numeric"
            autoComplete="off"
            validation={abnLiveValidation}
          />
          <AbnLiveValidationMessages
            validation={abnLiveValidation}
            detailsId="abn-validated-abn-details"
          />
          <p className="text-base text-muted-foreground dark:text-gray-500 md:text-[11px]">
            Same as in your profile. Required for professional cleaners.
          </p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="suburb" className="text-muted-foreground dark:text-gray-300">
            Suburb
          </Label>
          <Input
            id="suburb"
            name="suburb"
            defaultValue={profile?.suburb ?? ""}
            placeholder="e.g. LITTLE MOUNTAIN"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postcode" className="text-muted-foreground dark:text-gray-300">
            Postcode
          </Label>
          <Input
            id="postcode"
            name="postcode"
            defaultValue={profile?.postcode ?? ""}
            placeholder="e.g. 4551"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio" className="text-muted-foreground dark:text-gray-300">
          Bio
        </Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={profile?.bio ?? ""}
          placeholder="Share a little about your bond clean experience, equipment and approach."
          rows={4}
        />
      </div>
      <Button type="submit" size="lg" className="h-12 min-h-[48px] w-full rounded-full md:h-10 md:min-h-0 md:w-auto" disabled={isSaving}>
        {isSaving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

const LISTER_ONLY_EMAIL_KEYS = new Set<NotificationPreferenceKey>([
  "listing_published",
  "email_after_photos",
]);

const ALL_PREF_KEYS: NotificationPreferenceKey[] = [
  "email_notifications",
  "new_bid",
  "new_message",
  "job_accepted",
  "job_completed",
  "email_after_photos",
  "email_checklist_updates",
  "dispute",
  "payment_released",
  "listing_published",
  "receipt_emails",
  "weekly_tips",
  "daily_digest",
  "receive_all_non_critical",
  "email_welcome",
  "email_tutorial",
  "sms_enabled",
  "sms_job_alerts",
  "new_job_in_area",
  "push_enabled",
  "push_new_job",
  "in_app_sound",
  "in_app_vibrate",
  "in_app_qa_new_question",
  "in_app_qa_lister_reply",
];

/** Cleaners only: new-job radius alerts (SMS + push). */
const CLEANER_NEW_JOB_KEYS = new Set<NotificationPreferenceKey>([
  "sms_job_alerts",
  "push_new_job",
  "new_job_in_area",
]);

/** In-app bell chime + vibration (both roles). */
const IN_APP_FEEDBACK_KEYS = new Set<NotificationPreferenceKey>(["in_app_sound", "in_app_vibrate"]);

/** Q&A Chat in-app toggles; shown by role in Notifications form. */
const QA_IN_APP_KEYS = new Set<NotificationPreferenceKey>([
  "in_app_qa_new_question",
  "in_app_qa_lister_reply",
]);

function buildNotificationFormData(values: Record<string, boolean>): FormData {
  const fd = new FormData();
  for (const key of ALL_PREF_KEYS) {
    if (values[key]) fd.set(key, "on");
  }
  return fd;
}

function TestNotificationSoundButton() {
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();
  const handleTest = () => {
    primeNotificationAudioFromUserGesture();
    setTesting(true);
    void testNotificationChime()
      .then(() => {
        toast({
          title: "Test sound",
          description: "You should hear a soft ding. If not, tap the page once, check volume, and try again.",
        });
      })
      .catch((e: unknown) => {
        logClientError("settings.testNotificationSound", e);
        showAppErrorToast(toast, {
          flow: "settings",
          error: e instanceof Error ? e : new Error(String(e)),
          context: "settings.testNotificationSound",
        });
      })
      .finally(() => {
        setTesting(false);
      });
  };
  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      className="h-12 min-h-[48px] w-full rounded-full border-border dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800/90 md:h-8 md:min-h-0 md:w-auto"
      disabled={testing}
      onClick={handleTest}
    >
      {testing ? "Playing…" : "Test sound"}
    </Button>
  );
}

function SendTestSmsButton() {
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();
  const handleTest = async () => {
    setTesting(true);
    try {
      const { sendTestSms } = await import("@/lib/actions/sms-notifications");
      const result = await sendTestSms();
      if (result.ok) {
        toast({ title: "SMS sent", description: "Check your phone for the test message." });
      } else {
        logClientError("settings.testSms", result.error);
        showAppErrorToast(toast, {
          flow: "settings",
          error: new Error(result.error ?? ""),
          context: "settings.testSms",
        });
      }
    } finally {
      setTesting(false);
    }
  };
  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      className="h-12 min-h-[48px] w-full rounded-full border-border dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800/90 md:h-8 md:min-h-0 md:w-auto"
      disabled={testing}
      onClick={handleTest}
    >
      {testing ? "Sending…" : "Send test SMS"}
    </Button>
  );
}

export function SettingsNotificationsForm({
  prefs,
  locked = false,
  isCleaner = false,
  isLister = false,
}: {
  prefs: NotificationPrefs;
  locked?: boolean;
  /** When false, hides SMS/Push toggles for new job radius alerts (cleaner-only). */
  isCleaner?: boolean;
  /** When false, hides Q&A “new question on my listing” in-app toggle. */
  isLister?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const prefKeys = useMemo(() => {
    const base = isCleaner
      ? ALL_PREF_KEYS.filter((k) => !LISTER_ONLY_EMAIL_KEYS.has(k))
      : ALL_PREF_KEYS.filter((k) => !CLEANER_NEW_JOB_KEYS.has(k));
    const withoutQa = base.filter((k) => !QA_IN_APP_KEYS.has(k));
    const qa: NotificationPreferenceKey[] = [];
    if (isLister) qa.push("in_app_qa_new_question");
    if (isCleaner) qa.push("in_app_qa_lister_reply");
    return [...withoutQa, ...qa];
  }, [isCleaner, isLister]);
  const emailPrefKeys = useMemo(
    () =>
      prefKeys.filter(
        (k) => !IN_APP_FEEDBACK_KEYS.has(k) && !QA_IN_APP_KEYS.has(k)
      ),
    [prefKeys]
  );
  const inAppFeedbackPrefKeys = useMemo(
    () => prefKeys.filter((k) => IN_APP_FEEDBACK_KEYS.has(k)),
    [prefKeys]
  );
  const inAppQaPrefKeys = useMemo(
    () => prefKeys.filter((k) => QA_IN_APP_KEYS.has(k)),
    [prefKeys]
  );
  const initialValues = useMemo(() => {
    return ALL_PREF_KEYS.reduce(
      (acc, key) => {
        if (key === "sms_job_alerts") {
          const v =
            typeof prefs?.sms_job_alerts === "boolean"
              ? prefs.sms_job_alerts
              : typeof prefs?.sms_new_job === "boolean"
                ? prefs.sms_new_job
                : DEFAULT_NOTIFICATION_PREFERENCES.sms_job_alerts;
          return { ...acc, [key]: v };
        }
        return {
          ...acc,
          [key]:
            typeof prefs?.[key] === "boolean"
              ? prefs[key]!
              : DEFAULT_NOTIFICATION_PREFERENCES[key],
        };
      },
      {} as Record<string, boolean>
    );
  }, [prefs]);
  const [values, setValues] = useState<Record<string, boolean>>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const persistNotificationToggle = (key: NotificationPreferenceKey, checked: boolean) => {
    if (locked) return;
    const prev = { ...values };
    const next = { ...values, [key]: checked };
    setValues(next);
    startTransition(async () => {
      const result = await saveNotificationSettings(buildNotificationFormData(next));
      if (result.ok) {
        if (
          key === "in_app_sound" ||
          key === "in_app_vibrate" ||
          QA_IN_APP_KEYS.has(key)
        ) {
          router.refresh();
        }
        if (key === "push_enabled" && checked) {
          try {
            const { registerExpoPushTokenAsync } = await import("@/lib/pwa/expo-push-register");
            const { saveExpoPushToken } = await import("@/lib/actions/push-token");
            const token = await registerExpoPushTokenAsync();
            if (token?.trim()) await saveExpoPushToken(token.trim());
          } catch {
            // permission denied or Expo not configured
          }
        }
        const smsOn = next.sms_job_alerts;
        const pushJobOn = next.push_new_job;
        toast({
          title: "Notification preferences updated",
          description:
            smsOn || pushJobOn
              ? "New job alert preferences updated (cleaners in your radius may be notified when listings go live)."
              : "Your notification settings have been saved.",
        });
        return;
      }
      setValues(prev);
      logClientError("settings.notifications", result.error, { key });
      showAppErrorToast(toast, {
        flow: "settings",
        error: new Error(result.error ?? ""),
        context: "settings.notifications",
      });
    });
  };

  return (
    <div className="space-y-4 text-foreground dark:text-gray-100">
      <p className="text-base text-muted-foreground dark:text-gray-400 md:text-sm">
        Choose which emails you receive. Critical (payment, dispute) are on by default.
      </p>
      {locked && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50/70 px-4 py-3 text-base dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100 md:px-3 md:py-2 md:text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400 md:h-4 md:w-4" />
          <p>Notification preferences are locked by an administrator. Contact support to change them.</p>
        </div>
      )}
      <div className="space-y-1 rounded-xl border border-border/70 bg-muted/20 p-3 dark:border-gray-800 dark:bg-gray-900/40">
        {emailPrefKeys.map((key) => (
          <div
            key={key}
            className="flex min-h-[52px] items-center justify-between gap-4 border-b border-border/50 py-2 last:border-b-0 dark:border-gray-800/80 md:min-h-0 md:py-2.5"
          >
            <Label htmlFor={key} className="flex-1 cursor-pointer text-base dark:text-gray-200 md:text-sm">
              {NOTIFICATION_LABELS[key]}
            </Label>
            <input
              type="hidden"
              name={key}
              value={values[key] ? "on" : ""}
              readOnly
              aria-hidden
            />
            <Switch
              id={key}
              checked={values[key]}
              onCheckedChange={(checked) => persistNotificationToggle(key, checked)}
              disabled={locked || isPending}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground dark:text-gray-100">
          In-app alerts
        </p>
        <p className="text-base text-muted-foreground dark:text-gray-400 md:text-sm">
          When a new notification arrives in the bell, Bond Back can play a soft sound and vibrate (if your device supports it).
        </p>
        <div className="space-y-1 rounded-xl border border-border/70 bg-muted/20 p-3 dark:border-gray-800 dark:bg-gray-900/40">
          {inAppFeedbackPrefKeys.map((key) => (
            <div
              key={key}
              className="flex min-h-[52px] items-center justify-between gap-4 border-b border-border/50 py-2 last:border-b-0 dark:border-gray-800/80 md:min-h-0 md:py-2.5"
            >
              <div className="min-w-0 flex-1">
                <Label htmlFor={key} className="cursor-pointer text-base dark:text-gray-200 md:text-sm">
                  {NOTIFICATION_LABELS[key]}
                </Label>
                {key === "in_app_vibrate" && (
                  <p className="mt-0.5 text-xs text-muted-foreground dark:text-gray-500">
                    Works best on mobile
                  </p>
                )}
              </div>
              <input
                type="hidden"
                name={key}
                value={values[key] ? "on" : ""}
                readOnly
                aria-hidden
              />
              <Switch
                id={key}
                checked={values[key]}
                onCheckedChange={(checked) => persistNotificationToggle(key, checked)}
                disabled={locked || isPending}
              />
            </div>
          ))}
          <div className="pt-2">
            <TestNotificationSoundButton />
          </div>
        </div>
      </div>

      {inAppQaPrefKeys.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground dark:text-gray-100">
            Q&amp;A Chat (in-app)
          </p>
          <p className="text-base text-muted-foreground dark:text-gray-400 md:text-sm">
            Bell alerts on listing pages. Email is not sent for these.
          </p>
          <div className="space-y-1 rounded-xl border border-border/70 bg-muted/20 p-3 dark:border-gray-800 dark:bg-gray-900/40">
            {inAppQaPrefKeys.map((key) => (
              <div
                key={key}
                className="flex min-h-[52px] items-center justify-between gap-4 border-b border-border/50 py-2 last:border-b-0 dark:border-gray-800/80 md:min-h-0 md:py-2.5"
              >
                <Label htmlFor={key} className="flex-1 cursor-pointer text-base dark:text-gray-200 md:text-sm">
                  {NOTIFICATION_LABELS[key]}
                </Label>
                <input
                  type="hidden"
                  name={key}
                  value={values[key] ? "on" : ""}
                  readOnly
                  aria-hidden
                />
                <Switch
                  id={key}
                  checked={values[key]}
                  onCheckedChange={(checked) => persistNotificationToggle(key, checked)}
                  disabled={locked || isPending}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {/* Preserve cleaner-only prefs when lister saves (fields not shown) */}
      {ALL_PREF_KEYS.filter((k) => !prefKeys.includes(k)).map((key) => (
        <input
          key={`preserve-${key}`}
          type="hidden"
          name={key}
          value={values[key] ? "on" : ""}
          readOnly
          aria-hidden
        />
      ))}
      <p className="text-base text-muted-foreground dark:text-gray-500 md:text-xs">
        &ldquo;Receive all non-critical emails&rdquo; overrides individual toggles for non-critical types when on.
      </p>
      <p className="text-base text-muted-foreground dark:text-gray-500 md:text-xs">
        SMS notifications use your profile phone number and are limited to 5 per day. Critical events only (new job near you, bid accepted, job approved to start, payment released, dispute opened).
      </p>
      <p className="text-base text-muted-foreground dark:text-gray-500 md:text-xs">
        Push notifications work on mobile web and in the app. Turn on &ldquo;Receive push notifications&rdquo; and allow alerts when prompted (max 5 per day).
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SendTestSmsButton />
      </div>
    </div>
  );
}

export function SettingsPrivacyForm({ profilePublic }: { profilePublic: boolean }) {
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  const [publicProfile, setPublicProfile] = useState(profilePublic);
  const [privacySaving, setPrivacySaving] = useState(false);

  useEffect(() => {
    setPublicProfile(profilePublic);
  }, [profilePublic]);

  const onPublicChange = (checked: boolean) => {
    const prev = publicProfile;
    startTransition(() => setPublicProfile(checked));
    setPrivacySaving(true);
    void (async () => {
      try {
        const fd = new FormData();
        if (checked) fd.set("profile_public", "on");
        const result = await savePrivacySettings(fd);
        if (result.ok) {
          toast({
            title: "Privacy updated",
            description: "Your visibility preference is saved.",
          });
          return;
        }
        startTransition(() => setPublicProfile(prev));
        logClientError("settings.privacy", result.error);
        showAppErrorToast(toast, {
          flow: "settings",
          error: new Error(result.error ?? ""),
          context: "settings.privacy",
        });
      } finally {
        setPrivacySaving(false);
      }
    })();
  };

  return (
    <div className="relative space-y-4 text-foreground dark:text-gray-100">
      <FormSavingOverlay
        show={privacySaving}
        variant="card"
        title="Saving privacy…"
        className="min-h-[4.5rem]"
      />
      <div className="flex min-h-[52px] items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/40">
        <Label htmlFor="profile_public_switch" className="flex-1 cursor-pointer text-base dark:text-gray-200 md:text-sm">
          Show my profile publicly in search results
        </Label>
        <Switch
          id="profile_public_switch"
          checked={publicProfile}
          onCheckedChange={onPublicChange}
          disabled={privacySaving}
        />
      </div>
    </div>
  );
}

export function SettingsPasswordForm() {
  const [, startTransition] = useTransition();
  const [showSaveOverlay, setShowSaveOverlay] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "New password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    startTransition(() => setShowSaveOverlay(true));
    void (async () => {
      try {
        const result = await changePassword(currentPassword, newPassword);
        if (result.ok) {
          toast({
            title: "Password updated",
            description: "Your password has been changed. Use it next time you sign in.",
          });
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        } else {
          logClientError("settings.password", result.error);
          showAppErrorToast(toast, {
            flow: "settings",
            error: new Error(result.error ?? ""),
            context: "settings.password",
          });
        }
      } finally {
        setShowSaveOverlay(false);
      }
    })();
  };

  return (
    <form className="relative space-y-4 text-foreground dark:text-gray-100" onSubmit={handleSubmit}>
      <FormSavingOverlay show={showSaveOverlay} variant="card" title="Updating password…" />
      <div className="space-y-2">
        <Label htmlFor="current_password" className="text-muted-foreground dark:text-gray-300">
          Current password
        </Label>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter your current password"
          required
          className="w-full max-w-full md:max-w-xs"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new_password" className="text-muted-foreground dark:text-gray-300">
          New password
        </Label>
        <Input
          id="new_password"
          name="new_password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 6 characters"
          required
          minLength={6}
          className="w-full max-w-full md:max-w-xs"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_password" className="text-muted-foreground dark:text-gray-300">
          Confirm new password
        </Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter new password"
          required
          minLength={6}
          className="w-full max-w-full md:max-w-xs"
        />
      </div>
      <Button type="submit" size="lg" className="h-12 min-h-[48px] w-full rounded-full md:h-8 md:min-h-0 md:w-auto" disabled={showSaveOverlay}>
        {showSaveOverlay ? "Updating…" : "Change password"}
      </Button>
    </form>
  );
}
