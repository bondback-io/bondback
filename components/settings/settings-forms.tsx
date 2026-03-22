"use client";

import { useTransition, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  saveProfileSettings,
  saveNotificationSettings,
  savePrivacySettings,
  changePassword,
} from "@/app/settings/actions";
import { AlertTriangle } from "lucide-react";

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
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = await saveProfileSettings(formData);
          if (result.ok) {
            toast({
              title: "Settings saved successfully",
              description: "Your profile has been updated.",
            });
          } else {
            toast({
              title: "Error",
              description: result.error,
              variant: "destructive",
            });
          }
        });
      }}
    >
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
          <Input
            id="abn"
            name="abn"
            defaultValue={(profile?.abn ?? "").replace(/\D/g, "").slice(0, 11)}
            placeholder="e.g. 12345678901"
            maxLength={11}
            inputMode="numeric"
            autoComplete="off"
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
      <Button type="submit" size="lg" className="h-12 min-h-[48px] w-full rounded-full md:h-10 md:min-h-0 md:w-auto" disabled={isPending}>
        {isPending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_LABELS,
  type NotificationPreferenceKey,
} from "@/lib/notification-preferences";

const ALL_PREF_KEYS: NotificationPreferenceKey[] = [
  "new_bid",
  "new_message",
  "job_accepted",
  "job_completed",
  "dispute",
  "payment_released",
  "receipt_emails",
  "weekly_tips",
  "receive_all_non_critical",
  "email_welcome",
  "email_tutorial",
  "sms_enabled",
  "sms_new_job",
  "push_enabled",
  "push_new_job",
];

/** Cleaners only: new-job radius alerts (SMS + push). */
const CLEANER_NEW_JOB_KEYS = new Set<NotificationPreferenceKey>(["sms_new_job", "push_new_job"]);

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
        toast({ variant: "destructive", title: "SMS failed", description: result.error });
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
      className="h-12 min-h-[48px] w-full rounded-full md:h-8 md:min-h-0 md:w-auto"
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
}: {
  prefs: NotificationPrefs;
  locked?: boolean;
  /** When false, hides SMS/Push toggles for new job radius alerts (cleaner-only). */
  isCleaner?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const prefKeys = useMemo(
    () =>
      isCleaner
        ? ALL_PREF_KEYS
        : ALL_PREF_KEYS.filter((k) => !CLEANER_NEW_JOB_KEYS.has(k)),
    [isCleaner]
  );
  const initialValues = useMemo(
    () =>
      ALL_PREF_KEYS.reduce(
        (acc, key) => ({
          ...acc,
          [key]:
            typeof prefs?.[key] === "boolean"
              ? prefs[key]
              : DEFAULT_NOTIFICATION_PREFERENCES[key],
        }),
        {} as Record<string, boolean>
      ),
    [prefs]
  );
  const [values, setValues] = useState<Record<string, boolean>>(initialValues);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = await saveNotificationSettings(formData);
          if (result.ok) {
            const smsOn = formData.get("sms_new_job") === "on";
            const pushJobOn = formData.get("push_new_job") === "on";
            toast({
              title: "Notification preferences updated",
              description:
                smsOn || pushJobOn
                  ? "New job alert preferences updated (cleaners in your radius may be notified when listings go live)."
                  : "Your notification settings have been saved.",
            });
          } else {
            toast({
              title: "Error",
              description: result.error,
              variant: "destructive",
            });
          }
        });
      }}
    >
      <p className="text-base text-muted-foreground dark:text-gray-400 md:text-sm">
        Choose which emails you receive. Critical (payment, dispute) are on by default.
      </p>
      {locked && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50/70 px-4 py-3 text-base dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100 md:px-3 md:py-2 md:text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400 md:h-4 md:w-4" />
          <p>Notification preferences are locked by an administrator. Contact support to change them.</p>
        </div>
      )}
      <div className="space-y-4">
        {prefKeys.map((key) => (
          <div key={key} className="flex min-h-[52px] items-center justify-between gap-4 py-1 md:min-h-0 md:py-0">
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
              onCheckedChange={(checked) =>
                setValues((prev) => ({ ...prev, [key]: checked }))
              }
              disabled={locked}
            />
          </div>
        ))}
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
      </div>
      <p className="text-base text-muted-foreground dark:text-gray-500 md:text-xs">
        &ldquo;Receive all non-critical emails&rdquo; overrides individual toggles for non-critical types when on.
      </p>
      <p className="text-base text-muted-foreground dark:text-gray-500 md:text-xs">
        SMS notifications use your profile phone number and are limited to 5 per day. Critical events only (new job near you, bid accepted, job approved to start, payment released, dispute opened).
      </p>
      <p className="text-base text-muted-foreground dark:text-gray-500 md:text-xs">
        Push notifications require the Bond Back mobile app. Turn on the toggle here, then register your device in the app to receive alerts (max 5 per day).
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button type="submit" size="lg" className="h-12 min-h-[48px] w-full rounded-full md:h-8 md:min-h-0 md:w-auto" disabled={isPending || locked}>
          {isPending ? "Saving…" : "Save notification settings"}
        </Button>
        <SendTestSmsButton />
      </div>
    </form>
  );
}

export function SettingsPrivacyForm({ profilePublic }: { profilePublic: boolean }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [publicProfile, setPublicProfile] = useState(profilePublic);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = await savePrivacySettings(formData);
          if (result.ok) {
            toast({
              title: "Settings saved successfully",
              description: "Privacy preferences updated.",
            });
          } else {
            toast({
              title: "Error",
              description: result.error,
              variant: "destructive",
            });
          }
        });
      }}
    >
      <input type="hidden" name="profile_public" value={publicProfile ? "on" : ""} readOnly aria-hidden />
      <div className="flex min-h-[52px] items-center justify-between gap-4">
        <Label htmlFor="profile_public_switch" className="flex-1 cursor-pointer text-base dark:text-gray-200 md:text-sm">
          Show my profile publicly in search results
        </Label>
        <Switch
          id="profile_public_switch"
          checked={publicProfile}
          onCheckedChange={setPublicProfile}
        />
      </div>
      <Button type="submit" size="lg" className="h-12 min-h-[48px] w-full rounded-full md:h-8 md:min-h-0 md:w-auto" disabled={isPending}>
        {isPending ? "Saving…" : "Save privacy settings"}
      </Button>
    </form>
  );
}

export function SettingsPasswordForm() {
  const [isPending, startTransition] = useTransition();
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
    startTransition(async () => {
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
        toast({
          title: "Could not change password",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
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
      <Button type="submit" size="lg" className="h-12 min-h-[48px] w-full rounded-full md:h-8 md:min-h-0 md:w-auto" disabled={isPending}>
        {isPending ? "Updating…" : "Change password"}
      </Button>
    </form>
  );
}
