"use client";

import * as React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AbnLiveValidationState } from "@/hooks/use-abn-live-validation";

export const AbnValidationInputRow = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input> & {
    validation: AbnLiveValidationState;
  }
>(function AbnValidationInputRow(props, ref) {
  const { validation, className, id, ...rest } = props;
  const detailsId = id ? `${id}-validated-abn-details` : undefined;

  return (
    <div className="relative">
      <Input
        ref={ref}
        id={id}
        className={cn(
          "pr-10",
          validation.status === "valid" &&
            "border-emerald-500/70 ring-1 ring-emerald-500/20 dark:border-emerald-600/60 dark:ring-emerald-500/15",
          validation.status === "invalid" && "border-destructive/80",
          className
        )}
        aria-invalid={validation.status === "invalid"}
        aria-describedby={detailsId}
        {...rest}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center"
        aria-hidden
      >
        {validation.validating ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
        ) : validation.status === "valid" ? (
          <CheckCircle2
            className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-label="ABN validated"
          />
        ) : null}
      </div>
    </div>
  );
});
AbnValidationInputRow.displayName = "AbnValidationInputRow";

/** Shown when ABR returned an entity / business name */
export function ValidatedAbnDetails({
  id,
  details,
}: {
  id?: string;
  details: {
    entityName?: string;
    businessName?: string;
    suburb?: string;
    state?: string;
    abnStatus?: string;
    isActive?: boolean;
  };
}) {
  const name = details.entityName?.trim() ?? "";
  const businessName = details.businessName?.trim() ?? "—";
  const locationParts = [details.suburb?.trim(), details.state?.trim()].filter(Boolean);
  const location = locationParts.length ? locationParts.join(", ") : "—";
  const isActive = details.isActive === true;
  const statusLabel = details.abnStatus?.trim() || (isActive ? "Active" : "Inactive");

  if (!name && businessName === "—" && location === "—" && !details.abnStatus) return null;

  return (
    <div
      id={id}
      className={cn(
        "rounded-md border px-3 py-2 text-left",
        isActive
          ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/50"
          : "border-red-200 bg-red-50/90 dark:border-red-900/60 dark:bg-red-950/30"
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wide",
          isActive ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200"
        )}
      >
        Validated ABN details
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-medium leading-snug",
          isActive ? "text-emerald-950 dark:text-emerald-100" : "text-red-950 dark:text-red-100"
        )}
      >
        ABN Name: {name || "—"}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm leading-snug",
          isActive ? "text-emerald-950 dark:text-emerald-100" : "text-red-950 dark:text-red-100"
        )}
      >
        Business Name: {businessName}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm leading-snug",
          isActive ? "text-emerald-950 dark:text-emerald-100" : "text-red-950 dark:text-red-100"
        )}
      >
        Suburb & State: {location}
      </p>
      <p
        className={cn(
          "mt-0.5 flex items-center gap-1 text-sm leading-snug",
          isActive ? "text-emerald-950 dark:text-emerald-100" : "text-red-950 dark:text-red-100"
        )}
      >
        ABN Active Status:
        {isActive ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
        )}
        <span>{statusLabel}</span>
      </p>
    </div>
  );
}

/** Live validation messages: ABR error + optional entity block */
export function AbnLiveValidationMessages({
  validation,
  detailsId,
}: {
  validation: AbnLiveValidationState;
  detailsId?: string;
}) {
  return (
    <>
      {validation.status === "invalid" && validation.error && (
        <p className="text-xs text-destructive md:text-[13px]">{validation.error}</p>
      )}
      {validation.details && (
        <ValidatedAbnDetails
          id={detailsId}
          details={validation.details}
        />
      )}
    </>
  );
}
