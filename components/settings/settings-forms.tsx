"use client";

import { useTransition, useState, useEffect } from "react";
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
  savePrivacySettings,
  changePassword,
} from "@/app/settings/actions";
import { FormSavingOverlay } from "@/components/ui/form-saving-overlay";
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
