"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { submitDisputeMessage } from "@/lib/actions/disputes";

type Message = {
  id: string;
  body: string;
  author_role: string;
  created_at: string;
  is_escalation_event?: boolean | null;
};

export function DisputeThreadCard({
  jobId,
  messages,
}: {
  jobId: number;
  messages: Message[];
}) {
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
              <li key={m.id} className="rounded-lg border border-border bg-card p-3 dark:border-gray-700 dark:bg-gray-900">
                <p className="text-[11px] text-muted-foreground">
                  {m.author_role} • {new Date(m.created_at).toLocaleString()}
                </p>
                {m.is_escalation_event ? (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    Escalation event
                  </Badge>
                ) : null}
                <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
              </li>
            ))
          )}
        </ul>

        <form action={submitDisputeMessage} className="space-y-2">
          <input type="hidden" name="jobId" value={jobId} />
          <Textarea name="body" rows={3} required placeholder="Add a reply, update, or evidence note..." />
          <Textarea name="attachmentUrls" rows={2} placeholder="Optional attachment URLs, one per line." />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="escalate" value="1" className="h-4 w-4" />
            Request admin mediation
          </label>
          <Button type="submit">Send message</Button>
        </form>
      </CardContent>
    </Card>
  );
}
