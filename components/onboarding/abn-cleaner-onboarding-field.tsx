"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAbnLiveValidation } from "@/hooks/use-abn-live-validation";
import { AbnLiveValidationMessages } from "@/components/features/abn-validation-ui";

export type AbnCleanerOnboardingFieldProps = {
  /** e.g. `p2-abn` or `g-abn` — hint/feedback ids are `${id}-hint` / `${id}-feedback` */
  id: string;
  /** Digits-only string (max 11 chars). */
  value: string;
  onChange: (digitsOnly: string) => void;
  disabled?: boolean;
  /** Zod / server / submit errors — single destructive alert (same priority as Google flow). */
  primaryError?: string | null;
  /** When true, user can submit (11 digits + live ABR valid, not validating). */
  onReadyChange?: (canSubmit: boolean) => void;
};

/**
 * Shared ABN block for cleaner onboarding (email Path 2 + Google complete).
 * Live validation via {@link useAbnLiveValidation}; input is strictly 11 numeric digits.
 */
export function AbnCleanerOnboardingField({
  id,
  value,
  onChange,
  disabled,
  primaryError,
  onReadyChange,
}: AbnCleanerOnboardingFieldProps) {
  const abnDigits = value.replace(/\D/g, "").slice(0, 11);
  const abnLive = useAbnLiveValidation(abnDigits);

  useEffect(() => {
    const canSubmit =
      abnDigits.length === 11 && !abnLive.validating && abnLive.status === "valid";
    onReadyChange?.(canSubmit);
  }, [abnDigits, abnLive.validating, abnLive.status, onReadyChange]);

  const hintId = `${id}-hint`;
  const feedbackId = `${id}-feedback`;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-base">
          Australian Business Number (ABN) <span className="text-destructive">*</span>
        </Label>
        <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {abnDigits.length}/11 digits
        </span>
      </div>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className="min-h-12 text-base"
        placeholder="Enter 11 digits"
        maxLength={11}
        value={abnDigits}
        onChange={(e) => {
          onChange(e.target.value.replace(/\D/g, "").slice(0, 11));
        }}
        disabled={disabled}
        aria-invalid={
          Boolean(primaryError) || (abnDigits.length === 11 && abnLive.status === "invalid")
        }
        aria-describedby={`${hintId} ${feedbackId}`}
      />
      <p id={hintId} className="text-xs text-muted-foreground">
        Numbers only — spaces are ignored.
      </p>
      <div id={feedbackId} className="space-y-2">
        {primaryError && (
          <Alert variant="destructive" className="py-2 text-sm">
            <AlertDescription>{primaryError}</AlertDescription>
          </Alert>
        )}
        {!primaryError && abnLive.validating && abnDigits.length === 11 && (
          <p className="text-xs text-muted-foreground">Checking ABN…</p>
        )}
        {!primaryError && (
          <AbnLiveValidationMessages
            validation={abnLive}
            detailsId={`${id}-validated-abn-details`}
          />
        )}
      </div>
    </div>
  );
}
