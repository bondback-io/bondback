"use client";

import { useFormState } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { submitDisputeMessage, type DisputeActionState } from "@/lib/actions/disputes";
import type { SerializableDisputeMessage } from "@/lib/disputes/serialize-dispute-messages";
import { DisputeSubmitButton } from "@/components/disputes/dispute-submit-button";
import { OptimizedImage } from "@/components/ui/optimized-image";

export function DisputeThreadCard({
  jobId,
  messages,
}: {
  jobId: number;
  messages: SerializableDisputeMessage[];
}) {
  const [state, formAction] = useFormState(submitDisputeMessage, {} as DisputeActionState);

  return (
    <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-base">Dispute thread</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {messages.length === 0 ? (
            <li className="text-sm text-muted-foreground">No messages yet.</li>
          ) : (
            messages.map((m) => (
              <li
                key={m.id || `${m.created_at}-${m.body.slice(0, 12)}`}
                className="rounded-lg border border-border bg-card p-3 dark:border-gray-700 dark:bg-gray-900"
              >
                <p className="text-[11px] text-muted-foreground">
                  {m.author_role} • {new Date(m.created_at).toLocaleString()}
                </p>
                {m.is_escalation_event ? (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    Escalation event
                  </Badge>
                ) : null}
                <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
                {m.attachment_urls && m.attachment_urls.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {m.attachment_urls.map((url) => (
                      <li key={url} className="h-16 w-16 overflow-hidden rounded-md border dark:border-gray-600">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                          <OptimizedImage
                            src={url}
                            alt=""
                            width={64}
                            height={64}
                            className="h-full w-full object-cover"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))
          )}
        </ul>

        <form action={formAction} className="space-y-2">
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
          <Textarea name="body" rows={3} required placeholder="Add a reply, update, or evidence note..." />
          <Textarea name="attachmentUrls" rows={2} placeholder="Optional attachment URLs, one per line." />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="escalate" value="1" className="h-4 w-4" />
            Request admin mediation
          </label>
          <DisputeSubmitButton>Send message</DisputeSubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
