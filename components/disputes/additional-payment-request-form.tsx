"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitCleanerAdditionalPaymentRequest } from "@/lib/actions/disputes";

export function AdditionalPaymentRequestForm({ jobId }: { jobId: number }) {
  return (
    <Card className="border-violet-300/70 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20">
      <CardHeader>
        <CardTitle className="text-base">Request Additional Payment</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={submitCleanerAdditionalPaymentRequest} className="space-y-3">
          <input type="hidden" name="jobId" value={jobId} />
          <div className="space-y-1.5">
            <Label>Additional amount (AUD cents)</Label>
            <Input name="amountCents" type="number" min={100} step={50} required placeholder="e.g. 4500" />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea name="reason" rows={3} required placeholder="Explain why additional payment is required..." />
          </div>
          <Button type="submit" className="w-full min-h-[46px]">
            Send request to lister
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
