"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { addAdminDisputeCaseNote, type AdminCaseNoteState } from "@/lib/actions/disputes";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="w-fit">
      {pending ? "Saving…" : "Save admin note"}
    </Button>
  );
}

export function AdminDisputeCaseNoteForm({ jobId }: { jobId: number }) {
  const [state, formAction] = useFormState(addAdminDisputeCaseNote, {} as AdminCaseNoteState);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-indigo-300/60 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/25"
    >
      <input type="hidden" name="jobId" value={jobId} />
      <div>
        <Label htmlFor={`case-note-${jobId}`} className="text-xs font-semibold text-indigo-950 dark:text-indigo-100">
          Admin message / comment (dispute file)
        </Label>
        <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-gray-400">
          Logged as <strong className="text-foreground dark:text-gray-200">admin</strong> on the audit trail. Leave both
          boxes unchecked to keep this note internal (admin console only).
        </p>
      </div>
      <Textarea
        id={`case-note-${jobId}`}
        name="caseNoteBody"
        rows={3}
        required
        minLength={2}
        placeholder="Internal comment, instructions to the team, or a message to share with parties…"
        className="dark:bg-gray-900"
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-8">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground dark:text-gray-200">
          <input
            type="checkbox"
            name="visibleToLister"
            value="on"
            className="h-4 w-4 rounded border-input"
          />
          Lister can view this note
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground dark:text-gray-200">
          <input
            type="checkbox"
            name="visibleToCleaner"
            value="on"
            className="h-4 w-4 rounded border-input"
          />
          Cleaner can view this note
        </label>
      </div>
      {state?.error ? (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok && state.success ? (
        <Alert className="border-emerald-600/40 bg-emerald-50/90 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
          <AlertDescription className="text-xs text-emerald-950 dark:text-emerald-100">{state.success}</AlertDescription>
        </Alert>
      ) : null}
      <SubmitButton />
    </form>
  );
}
