"use client";

import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { openEscalatedDispute } from "@/lib/actions/disputes";

const REASONS = [
  "Quality issue",
  "Incomplete tasks",
  "Damage claim",
  "Timing/no-show",
  "Payment disagreement",
  "Other",
];

type Props = {
  jobId: number;
  isLister: boolean;
  agreedAmountCents: number;
};

export function RaiseDisputeForm({ jobId, isLister, agreedAmountCents }: Props) {
  const [reason, setReason] = useState(REASONS[0]);
  const [refundPct, setRefundPct] = useState(0);
  const proposedRefundCents = useMemo(
    () => Math.round((Math.max(0, agreedAmountCents) * refundPct) / 100),
    [agreedAmountCents, refundPct]
  );

  return (
    <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-base">Raise a dispute</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={openEscalatedDispute} className="space-y-3">
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="reason" value={reason} />
          {isLister ? <input type="hidden" name="proposedRefundCents" value={proposedRefundCents} /> : null}

          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLister && (
            <div className="space-y-1.5">
              <Label>Partial refund offer</Label>
              <Slider value={[refundPct]} onValueChange={([v]) => setRefundPct(v ?? 0)} min={0} max={100} step={5} />
              <p className="text-xs text-muted-foreground">
                {refundPct}% (${(proposedRefundCents / 100).toFixed(2)})
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Detailed description</Label>
            <Textarea name="details" rows={4} required placeholder="Describe the issue and expected outcome..." />
          </div>

          <div className="space-y-1.5">
            <Label>Attachment URLs (optional)</Label>
            <Textarea name="attachmentUrls" rows={3} placeholder="Paste one URL per line (uploaded images/files)." />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requestMediation" value="1" className="h-4 w-4" />
            Request admin mediation now
          </label>

          <Button type="submit" className="w-full min-h-[46px]">
            Submit dispute
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
