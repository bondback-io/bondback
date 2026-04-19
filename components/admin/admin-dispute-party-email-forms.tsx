"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  sendAdminDisputePartyEmail,
  type AdminDisputeEmailState,
} from "@/lib/actions/disputes";

function SubmitRow({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="w-fit">
      {pending ? "Sending…" : label}
    </Button>
  );
}

export function AdminDisputePartyEmailForms({ jobId }: { jobId: number }) {
  const [listerState, listerAction] = useFormState(sendAdminDisputePartyEmail, {} as AdminDisputeEmailState);
  const [cleanerState, cleanerAction] = useFormState(sendAdminDisputePartyEmail, {} as AdminDisputeEmailState);

  return (
    <div className="grid gap-4 rounded-lg border border-sky-300/60 bg-sky-50/50 p-3 dark:border-sky-900 dark:bg-sky-950/20">
      <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">
        Email a party (logged in dispute activity + email log)
      </p>
      <form action={listerAction} className="space-y-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="recipient" value="lister" />
        <Label className="text-xs">Email lister</Label>
        <Input name="subject" placeholder="Subject line" required className="dark:bg-gray-900" />
        <Textarea name="body" rows={3} required placeholder="Message…" className="dark:bg-gray-900" />
        {listerState?.error ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{listerState.error}</AlertDescription>
          </Alert>
        ) : null}
        {listerState?.ok && listerState.success ? (
          <Alert className="border-emerald-600/40 bg-emerald-50/90 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
            <AlertDescription className="text-xs text-emerald-950 dark:text-emerald-100">
              {listerState.success}
            </AlertDescription>
          </Alert>
        ) : null}
        <SubmitRow label="Send to lister" />
      </form>
      <form action={cleanerAction} className="space-y-2 border-t border-border pt-3 dark:border-gray-700">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="recipient" value="cleaner" />
        <Label className="text-xs">Email cleaner</Label>
        <Input name="subject" placeholder="Subject line" required className="dark:bg-gray-900" />
        <Textarea name="body" rows={3} required placeholder="Message…" className="dark:bg-gray-900" />
        {cleanerState?.error ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{cleanerState.error}</AlertDescription>
          </Alert>
        ) : null}
        {cleanerState?.ok && cleanerState.success ? (
          <Alert className="border-emerald-600/40 bg-emerald-50/90 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
            <AlertDescription className="text-xs text-emerald-950 dark:text-emerald-100">
              {cleanerState.success}
            </AlertDescription>
          </Alert>
        ) : null}
        <SubmitRow label="Send to cleaner" />
      </form>
    </div>
  );
}
