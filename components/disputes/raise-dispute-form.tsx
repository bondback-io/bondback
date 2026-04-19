"use client";

import { useFormState } from "react-dom";
import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { openEscalatedDispute, type DisputeActionState } from "@/lib/actions/disputes";
import { DisputeSubmitButton } from "@/components/disputes/dispute-submit-button";

/** Property lister: issues with the clean or service received. */
const LISTER_DISPUTE_REASONS = [
  "Quality issue",
  "Incomplete tasks",
  "Damage claim",
  "Timing/no-show",
  "Payment disagreement",
  "Other",
] as const;

/** Assigned cleaner: scope, site conditions, or lister-provided information. */
const CLEANER_DISPUTE_REASONS = [
  "Scope larger than the listing described",
  "Unexpected site conditions (access, heavy soiling, safety)",
  "Job took much longer than reasonable for the listed details",
  "Extra work requested on site by the lister",
  "Incorrect or incomplete property details from the lister",
  "Access, keys, or equipment not as described",
  "Disagreement over payment or agreed scope",
  "Other",
] as const;

type Props = {
  jobId: number;
  isLister: boolean;
  agreedAmountCents: number;
};

export function RaiseDisputeForm({ jobId, isLister, agreedAmountCents }: Props) {
  const [state, formAction] = useFormState(openEscalatedDispute, {} as DisputeActionState);
  const reasons = useMemo(
    () => (isLister ? [...LISTER_DISPUTE_REASONS] : [...CLEANER_DISPUTE_REASONS]),
    [isLister]
  );
  const [reason, setReason] = useState<string>(() =>
    isLister ? LISTER_DISPUTE_REASONS[0] : CLEANER_DISPUTE_REASONS[0]
  );
  const [refundPct, setRefundPct] = useState(0);
  const [clientError, setClientError] = useState<string | null>(null);

  const proposedRefundCents = useMemo(
    () => Math.round((Math.max(0, agreedAmountCents) * refundPct) / 100),
    [agreedAmountCents, refundPct]
  );

  const showPartialRefundSlider = isLister && agreedAmountCents > 0;

  return (
    <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-base">Raise a dispute</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={formAction}
          className="space-y-3"
          onSubmit={(e) => {
            const fd = new FormData(e.currentTarget);
            const urls = String(fd.get("attachmentUrls") ?? "")
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean);
            if (urls.length < 1) {
              e.preventDefault();
              setClientError("Add at least one evidence URL (link to a photo or file). This is required to open a dispute.");
              return;
            }
            setClientError(null);
          }}
        >
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="reason" value={reason} />
          {showPartialRefundSlider ? (
            <input type="hidden" name="proposedRefundCents" value={proposedRefundCents} />
          ) : null}

          {state?.error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          {clientError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{clientError}</AlertDescription>
            </Alert>
          ) : null}
          {state?.ok && state.success ? (
            <Alert className="border-emerald-600/50 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
              <AlertDescription>{state.success}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showPartialRefundSlider ? (
            <div className="space-y-1.5">
              <Label>Partial refund offer</Label>
              <Slider value={[refundPct]} onValueChange={([v]) => setRefundPct(v ?? 0)} min={0} max={100} step={5} />
              <p className="text-xs text-muted-foreground">
                {refundPct}% (${(proposedRefundCents / 100).toFixed(2)})
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Detailed description</Label>
            <Textarea
              name="details"
              rows={4}
              required
              placeholder="Describe the issue and expected outcome..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Attachment URLs (required)</Label>
            <Textarea
              name="attachmentUrls"
              rows={3}
              required
              placeholder="Paste at least one URL per line (e.g. link to photos you uploaded)."
            />
            <p className="text-xs text-muted-foreground">
              At least one link is required — same rule as the full dispute flow on the job page.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requestMediation" value="1" className="h-4 w-4" />
            Request admin mediation now
          </label>

          <DisputeSubmitButton className="w-full min-h-[46px]">Submit dispute</DisputeSubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
