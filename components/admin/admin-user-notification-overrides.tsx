"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  adminSetEmailForceDisabled,
  adminSetEmailPreferencesLock,
  adminUpdateNotificationPreferences,
} from "@/lib/actions/admin-users";

type Props = {
  userId: string;
  emailForceDisabled: boolean;
  emailPreferencesLocked: boolean;
  currentPrefs: Record<string, boolean>;
};

export function AdminUserNotificationOverrides({
  userId,
  emailForceDisabled,
  emailPreferencesLocked,
  currentPrefs,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [forceDisabled, setForceDisabled] = useState(emailForceDisabled);
  const [locked, setLocked] = useState(emailPreferencesLocked);
  const [jsonInput, setJsonInput] = useState(JSON.stringify(currentPrefs, null, 2));
  const [pendingForce, setPendingForce] = useState(false);
  const [pendingLock, setPendingLock] = useState(false);
  const [pendingJson, setPendingJson] = useState(false);

  const onForceToggle = async (checked: boolean) => {
    setPendingForce(true);
    const result = await adminSetEmailForceDisabled(userId, checked, checked);
    setPendingForce(false);
    if (result.ok) {
      setForceDisabled(checked);
      router.refresh();
      toast({
        title: checked ? "Emails force-disabled" : "Emails re-enabled",
        description: checked ? "All emails for this user are now disabled and preferences locked." : undefined,
      });
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error });
    }
  };

  const onLockToggle = async (checked: boolean) => {
    setPendingLock(true);
    const result = await adminSetEmailPreferencesLock(userId, checked);
    setPendingLock(false);
    if (result.ok) {
      setLocked(checked);
      router.refresh();
      toast({
        title: checked ? "Preferences locked" : "Preferences unlocked",
      });
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error });
    }
  };

  const onSaveJson = async () => {
    let parsed: Record<string, boolean>;
    try {
      parsed = JSON.parse(jsonInput) as Record<string, boolean>;
      if (typeof parsed !== "object" || parsed === null) throw new Error("Must be an object");
      for (const v of Object.values(parsed)) {
        if (typeof v !== "boolean") throw new Error("All values must be boolean");
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Invalid JSON",
        description: e instanceof Error ? e.message : "Must be valid JSON object with boolean values.",
      });
      return;
    }
    setPendingJson(true);
    const result = await adminUpdateNotificationPreferences(userId, parsed);
    setPendingJson(false);
    if (result.ok) {
      router.refresh();
      toast({ title: "Preferences updated", description: "Notification preferences override saved." });
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error });
    }
  };

  return (
    <div className="space-y-4 border-t border-border pt-4 dark:border-gray-700">
      <Alert variant="warning" className="border-amber-200 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription>
          Admin overrides apply immediately. Force-disable sets all preferences to off and locks. User cannot change preferences when locked.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id="force-disable"
            checked={forceDisabled}
            onCheckedChange={onForceToggle}
            disabled={pendingForce}
          />
          <Label htmlFor="force-disable" className="cursor-pointer text-sm">
            Force-disable all emails for this user
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="lock-prefs"
            checked={locked}
            onCheckedChange={onLockToggle}
            disabled={pendingLock}
          />
          <Label htmlFor="lock-prefs" className="cursor-pointer text-sm">
            Lock preferences (user cannot change)
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Override notification_preferences (JSON)</Label>
        <textarea
          className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          spellCheck={false}
        />
        <Button size="sm" onClick={onSaveJson} disabled={pendingJson}>
          {pendingJson ? "Saving…" : "Save override"}
        </Button>
      </div>
    </div>
  );
}
