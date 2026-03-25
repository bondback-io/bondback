"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { saveUserPreferences } from "@/app/settings/actions";
import type { DistanceUnitPref, ThemePreference } from "@/lib/types";
import { setActiveRole } from "@/lib/actions/profile";
import { notifyActiveRoleChanged } from "@/lib/active-role-events";
import { applyThemeToDocument } from "@/lib/theme-client";
import { setDistanceUnitClient } from "@/hooks/use-distance-unit";
import type { ProfileRole } from "@/lib/types";
import { Brush, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormSavingOverlay } from "@/components/ui/form-saving-overlay";

type Props = {
  themePreference: ThemePreference;
  distanceUnit: DistanceUnitPref;
  roles: string[];
  activeRole: string | null;
};

export function SettingsPreferencesForm({
  themePreference: initialTheme,
  distanceUnit: initialDistance,
  roles,
  activeRole,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [displayTheme, setDisplayTheme] = useState(initialTheme);
  const [displayDistance, setDisplayDistance] = useState(initialDistance);
  const [prefsSaving, setPrefsSaving] = useState(false);

  useEffect(() => {
    setDisplayTheme(initialTheme);
    setDisplayDistance(initialDistance);
  }, [initialTheme, initialDistance]);

  const hasLister = roles.includes("lister");
  const hasCleaner = roles.includes("cleaner");
  const dualRole = hasLister && hasCleaner;

  const handleSaveDisplayPrefs = (theme: ThemePreference, distance: DistanceUnitPref) => {
    const prevTheme = displayTheme;
    const prevDistance = displayDistance;
    startTransition(() => {
      setDisplayTheme(theme);
      setDisplayDistance(distance);
    });
    setPrefsSaving(true);
    void (async () => {
      try {
        const result = await saveUserPreferences({
          theme_preference: theme,
          distance_unit: distance,
        });
        if (!result.ok) {
          startTransition(() => {
            setDisplayTheme(prevTheme);
            setDisplayDistance(prevDistance);
          });
          toast({ variant: "destructive", title: "Couldn’t save", description: result.error });
          return;
        }
        applyThemeToDocument(theme);
        setDistanceUnitClient(distance);
        toast({ title: "Preferences saved", description: "Theme and distance display updated." });
        router.refresh();
      } finally {
        setPrefsSaving(false);
      }
    })();
  };

  const switchDefaultRole = (role: ProfileRole) => {
    if (activeRole === role) return;
    setPrefsSaving(true);
    void (async () => {
      try {
        const result = await setActiveRole(role);
        if (!result.ok) {
          toast({ variant: "destructive", title: "Couldn’t switch", description: result.error });
          return;
        }
        notifyActiveRoleChanged();
        toast({
          title: role === "lister" ? "Lister mode" : "Cleaner mode",
          description: "Default role updated. Dashboard links will use this mode.",
        });
        const dest = role === "lister" ? "/lister/dashboard" : "/cleaner/dashboard";
        router.replace(dest);
        router.refresh();
      } finally {
        setPrefsSaving(false);
      }
    })();
  };

  return (
    <div className="relative space-y-8">
      <FormSavingOverlay
        show={prefsSaving}
        variant="card"
        title="Saving preferences…"
        description="Theme, distance, or default role — syncing to your account."
      />
      {/* Theme */}
      <div className="space-y-3">
        <div>
          <Label className="text-base font-semibold text-foreground dark:text-gray-100">Theme</Label>
          <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
            Applies across the site. You can also use the sun/moon button in the header for a quick toggle (saved to your account when logged in).
          </p>
        </div>
        <RadioGroup
          value={displayTheme}
          onValueChange={(v) => handleSaveDisplayPrefs(v as ThemePreference, displayDistance)}
          className="grid gap-2 sm:grid-cols-3"
          disabled={prefsSaving}
        >
          {(
            [
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ] as const
          ).map(({ value, label }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 transition-colors dark:border-gray-800 dark:bg-gray-900/50",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                prefsSaving && "pointer-events-none opacity-60"
              )}
            >
              <RadioGroupItem value={value} id={`theme-${value}`} />
              <span className="text-sm font-medium dark:text-gray-100">{label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Distance unit — all roles (job cards & search use km internally) */}
      <div className="space-y-3">
        <div>
          <Label className="text-base font-semibold text-foreground dark:text-gray-100">
            Distance unit
          </Label>
          <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
            How distances and search radius are shown. Search and travel limits still use kilometres in the background.
          </p>
        </div>
        <RadioGroup
          value={displayDistance}
          onValueChange={(v) => handleSaveDisplayPrefs(displayTheme, v as DistanceUnitPref)}
          className="grid gap-2 sm:grid-cols-2"
          disabled={prefsSaving}
        >
          {(
            [
              { value: "km", label: "Kilometres (km)" },
              { value: "mi", label: "Miles (mi)" },
            ] as const
          ).map(({ value, label }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 transition-colors dark:border-gray-800 dark:bg-gray-900/50",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                prefsSaving && "pointer-events-none opacity-60"
              )}
            >
              <RadioGroupItem value={value} id={`dist-${value}`} />
              <span className="text-sm font-medium dark:text-gray-100">{label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Default role — dual-role only */}
      {dualRole && (
        <div className="space-y-3">
          <div>
            <Label className="text-base font-semibold text-foreground dark:text-gray-100">
              Default role
            </Label>
            <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
              Choose which mode you start in after signing in. Same as the lister/cleaner switch in the header.
            </p>
          </div>
          <div
            className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/40 p-1.5 dark:border-gray-800 dark:bg-gray-900/70"
            role="group"
            aria-label="Default role"
          >
            <button
              type="button"
              disabled={prefsSaving || activeRole === "lister"}
              onClick={() => switchDefaultRole("lister")}
              className={cn(
                "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-3 text-sm font-semibold transition-all",
                activeRole === "lister"
                  ? "bg-background text-foreground shadow-md ring-1 ring-sky-500/40 dark:bg-gray-950 dark:text-gray-50 dark:ring-sky-500/50"
                  : "text-muted-foreground hover:bg-background/80 dark:text-gray-400 dark:hover:bg-gray-800/80"
              )}
            >
              <Home
                className={cn(
                  "h-6 w-6",
                  activeRole === "lister" ? "text-sky-600 dark:text-sky-400" : "opacity-70"
                )}
                aria-hidden
              />
              <span>Lister</span>
            </button>
            <button
              type="button"
              disabled={prefsSaving || activeRole === "cleaner"}
              onClick={() => switchDefaultRole("cleaner")}
              className={cn(
                "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-3 text-sm font-semibold transition-all",
                activeRole === "cleaner"
                  ? "bg-background text-foreground shadow-md ring-1 ring-emerald-500/40 dark:bg-gray-950 dark:text-gray-50 dark:ring-emerald-500/50"
                  : "text-muted-foreground hover:bg-background/80 dark:text-gray-400 dark:hover:bg-gray-800/80"
              )}
            >
              <Brush
                className={cn(
                  "h-6 w-6",
                  activeRole === "cleaner" ? "text-emerald-600 dark:text-emerald-400" : "opacity-70"
                )}
                aria-hidden
              />
              <span>Cleaner</span>
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground dark:text-gray-500">
        Theme and distance are stored on your profile. Single-role accounts see default role only when you add a second role in Profile.
      </p>
    </div>
  );
}
