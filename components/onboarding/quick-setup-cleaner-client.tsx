"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ProgressRing } from "@/components/ui/progress-ring";
import { saveCleanerQuickSetup } from "@/lib/actions/onboarding";
import { Brush } from "lucide-react";
import { FormSavingOverlay } from "@/components/ui/form-saving-overlay";
import { MAX_TRAVEL_KM } from "@/lib/max-travel-km";

const DEFAULT_KM = 30;

/**
 * Cleaner quick-setup: optional ABN + travel radius. "Verify later" skips ABN verification.
 */
export function QuickSetupCleanerClient() {
  const router = useRouter();
  const [, startQuickTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [abn, setAbn] = useState("");
  const [km, setKm] = useState([DEFAULT_KM]);
  const [error, setError] = useState<string | null>(null);

  const submit = (skipAbn: boolean) => {
    setError(null);
    const digits = abn.replace(/\D/g, "");
    if (!skipAbn && digits.length > 0 && digits.length !== 11) {
      setError("ABN must be 11 digits, or leave blank and verify later.");
      return;
    }

    startQuickTransition(() => setSaving(true));
    void (async () => {
      try {
        const result = await saveCleanerQuickSetup({
          abn: skipAbn ? null : digits.length === 11 ? digits : null,
          max_travel_km: km[0] ?? DEFAULT_KM,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.replace("/cleaner/dashboard");
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col justify-center gap-6 px-3 py-10">
      <FormSavingOverlay
        show={saving}
        variant="screen"
        title="Saving your cleaner profile…"
        description="Applying travel radius and business details."
      />
      <div className="flex flex-col items-center gap-3 text-center">
        <ProgressRing value={100} size={88} strokeWidth={7} label="2/2" />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40">
          <Brush className="h-8 w-8 text-emerald-700 dark:text-emerald-300" aria-hidden />
        </div>
        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
          Almost there, cleaner
        </h1>
        <p className="text-pretty text-base text-muted-foreground sm:text-lg">
          Add your ABN when you&apos;re ready — or verify later from Settings.
        </p>
      </div>

      <Card className="relative border-border/80 shadow-md dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-lg">Business details</CardTitle>
          <CardDescription className="text-base">
            Max travel sets how far you&apos;re willing to go for bond cleans.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="abn" className="text-base">
              ABN (optional)
            </Label>
            <Input
              id="abn"
              inputMode="numeric"
              autoComplete="off"
              placeholder="11 digits"
              className="min-h-12 text-base"
              value={abn}
              onChange={(e) => setAbn(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-base">Max travel</Label>
              <span className="text-base font-semibold tabular-nums">{km[0]} km</span>
            </div>
            <Slider
              min={5}
              max={MAX_TRAVEL_KM}
              step={5}
              value={km}
              onValueChange={setKm}
              className="py-1"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              size="lg"
              className="min-h-14 w-full flex-1 text-base font-semibold sm:min-h-12"
              disabled={saving}
              onClick={() => submit(false)}
            >
              {saving ? "Saving…" : "Continue"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-14 w-full flex-1 text-base font-semibold sm:min-h-12"
              disabled={saving}
              onClick={() => submit(true)}
            >
              Verify later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
