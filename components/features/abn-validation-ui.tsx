"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
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
        aria-describedby={
          validation.entityName?.trim() ? detailsId : undefined
        }
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
  entityName,
}: {
  id?: string;
  entityName: string;
}) {
  const name = entityName.trim();
  if (!name) return null;

  return (
    <div
      id={id}
      className="rounded-md border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-left dark:border-emerald-800 dark:bg-emerald-950/50"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
        Validated ABN details
      </p>
      <p className="mt-1 text-sm font-medium leading-snug text-emerald-950 dark:text-emerald-100">
        {name}
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
      {validation.status === "valid" && validation.entityName?.trim() && (
        <ValidatedAbnDetails
          id={detailsId}
          entityName={validation.entityName.trim()}
        />
      )}
    </>
  );
}
