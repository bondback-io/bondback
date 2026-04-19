"use client";

import { useFormState } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { submitCleanerAdditionalPaymentRequest, type DisputeActionState } from "@/lib/actions/disputes";
import { DisputeSubmitButton } from "@/components/disputes/dispute-submit-button";

export function AdditionalPaymentRequestForm({ jobId }: { jobId: number }) {
  const [state, formAction] = useFormState(submitCleanerAdditionalPaymentRequest, {} as DisputeActionState);

  return (
    <Card className="border-violet-300/70 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20">
      <CardHeader>
        <CardTitle className="text-base">Request Additional Payment</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="jobId" value={jobId} />

          {state?.error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          {state?.ok && state.success ? (
            <Alert className="border-emerald-600/50 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
              <AlertDescription>{state.success}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label>Additional amount (AUD)</Label>
            <Input
              name="amountAud"
              type="number"
              min={1}
              step={0.01}
              required
              placeholder="e.g. 80"
              aria-describedby="additional-pay-min-hint"
            />
            <p id="additional-pay-min-hint" className="text-xs text-muted-foreground">
              Minimum $1.00. Enter dollars (not cents).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea
              name="reason"
              rows={3}
              required
              placeholder="Explain why additional payment is required..."
            />
          </div>
          <DisputeSubmitButton className="w-full min-h-[46px]">Send request to lister</DisputeSubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
