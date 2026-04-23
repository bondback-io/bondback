"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  adminSubmitMediationSettlement,
  fetchMediationSettlementAiSuggestion,
} from "@/lib/actions/admin-jobs";
import { isJobCancelledStatus } from "@/lib/jobs/job-status-helpers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles } from "lucide-react";

function formatAudFromCents(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

function MediationSubmitButton({ binding }: { binding: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" className="w-fit gap-1.5" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {binding ? "Apply binding settlement" : "Send for acceptance"}
    </Button>
  );
}

export function AdminMediationSettlementPanel({
  jobId,
  agreedAmountCents,
  proposedRefundCents,
  counterRefundCents,
  jobStatus,
}: {
  jobId: number;
  agreedAmountCents: number;
  proposedRefundCents: number;
  counterRefundCents: number;
  jobStatus: string;
}) {
  const st = String(jobStatus ?? "").toLowerCase();
  const isTerminal = st === "completed" || isJobCancelledStatus(st);

  const [refundAud, setRefundAud] = useState(() => {
    const c = Math.max(proposedRefundCents, counterRefundCents);
    return c > 0 ? (c / 100).toFixed(2) : "";
  });
  const [topUpAud, setTopUpAud] = useState("");
  const [notes, setNotes] = useState("");
  const [binding, setBinding] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiLoading, startAi] = useTransition();
  const router = useRouter();

  const [state, formAction] = useFormState(adminSubmitMediationSettlement, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const refundCentsForSubmit = Math.max(0, Math.round(parseFloat(refundAud || "0") * 100) || 0);
  const topUpCentsForSubmit = Math.max(0, Math.round(parseFloat(topUpAud || "0") * 100) || 0);

  if (isTerminal) {
    return (
      <p className="text-xs text-muted-foreground dark:text-gray-500">
        Mediation tools are hidden because this job is already completed or cancelled.
      </p>
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border border-violet-300/70 bg-violet-50/70 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
          Mediation settlement
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground dark:text-gray-400">
          Suggest a refund to the lister (from the agreed job payment in escrow) and optionally an extra payment to
          the cleaner.{" "}
          <strong className="font-medium text-foreground dark:text-gray-200">Send for acceptance</strong> requires
          both parties to agree; if you include a top-up, the lister must still complete checkout — you cannot force
          extra payment.{" "}
          <strong className="font-medium text-foreground dark:text-gray-200">Binding settlement</strong> applies
          your refund (if any), releases the remainder to the cleaner, and completes the job — only when top-up is
          $0.
        </p>
      </div>

      <div className="rounded-md border border-violet-200/80 bg-white/50 px-3 py-2 text-[11px] dark:border-violet-900/50 dark:bg-gray-900/40">
        <p className="font-medium text-foreground dark:text-gray-200">Context</p>
        <p className="mt-0.5 text-muted-foreground dark:text-gray-400">
          Agreed job payment: {agreedAmountCents > 0 ? formatAudFromCents(agreedAmountCents) : "—"}
          {proposedRefundCents > 0 ? (
            <> · Lister asked refund: {formatAudFromCents(proposedRefundCents)}</>
          ) : null}
          {counterRefundCents > 0 ? (
            <> · Cleaner counter refund: {formatAudFromCents(counterRefundCents)}</>
          ) : null}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            disabled={aiLoading || agreedAmountCents < 1}
            onClick={() => {
              startAi(async () => {
                setAiNote(null);
                const res = await fetchMediationSettlementAiSuggestion(jobId);
                if (!res.ok) {
                  setAiNote(res.error);
                  return;
                }
                setRefundAud((res.refund_cents / 100).toFixed(2));
                setAiNote(
                  `${res.source === "heuristic" ? "Heuristic" : "AI"} suggestion: ${res.rationale} (${formatAudFromCents(res.refund_cents)} — you can edit below).`
                );
              });
            }}
          >
            {aiLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
            Suggest fair refund
          </Button>
          {agreedAmountCents < 1 ? (
            <span className="text-[10px] text-muted-foreground">No agreed amount on file.</span>
          ) : null}
        </div>
        {aiNote ? (
          <Alert className="mt-2 border-violet-300/60 bg-violet-50/80 py-2 dark:border-violet-800 dark:bg-violet-950/40">
            <AlertDescription className="text-[11px] leading-snug text-violet-950 dark:text-violet-100">
              {aiNote}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <form action={formAction} className="grid gap-2">
        <input type="hidden" name="jobId" value={String(jobId)} />
        <input type="hidden" name="settlementMode" value={binding ? "final_override" : "collaborative"} />
        <input type="hidden" name="refundCents" value={String(refundCentsForSubmit)} />
        <input type="hidden" name="additionalPaymentCents" value={String(topUpCentsForSubmit)} />

        <div className="flex items-start gap-2 rounded-md border border-amber-200/70 bg-amber-50/40 p-2 dark:border-amber-900/40 dark:bg-amber-950/20">
          <Checkbox
            id={`binding-${jobId}`}
            checked={binding}
            onCheckedChange={(v) => {
              const on = v === true;
              setBinding(on);
              if (on && topUpAud.trim() !== "" && parseFloat(topUpAud) > 0) {
                setTopUpAud("");
              }
            }}
          />
          <Label htmlFor={`binding-${jobId}`} className="cursor-pointer text-[11px] font-normal leading-snug">
            <span className="font-semibold text-foreground dark:text-gray-100">Binding settlement (admin override)</span>
            <span className="block text-muted-foreground dark:text-gray-400">
              Refund the lister this amount (if any), release the rest to the cleaner, complete the job. Top-up must be
              empty. Use only when you are sure Stripe escrow is intact.
            </span>
          </Label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Refund to lister (AUD)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={refundAud}
              onChange={(e) => setRefundAud(e.target.value)}
              placeholder="0.00"
              className="mt-1 dark:bg-gray-900"
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              From Stripe escrow. The maximum is the <strong>remaining</strong> refundable amount on the payment
              charge(s) after any refunds already issued there — often lower than job + fee on paper. If submission
              fails, reduce this to match Stripe&apos;s remaining balance.
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Extra to cleaner — lister top-up (AUD) {binding ? "(disabled for binding)" : ""}
            </Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={topUpAud}
              disabled={binding}
              onChange={(e) => setTopUpAud(e.target.value)}
              placeholder="0.00"
              className="mt-1 dark:bg-gray-900"
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Requires both parties to accept, then lister pays in app. Cannot be imposed.
            </p>
          </div>
        </div>

        <div>
          <Label className="text-xs">Settlement notes (shown to parties)</Label>
          <Textarea
            name="proposalText"
            rows={4}
            required
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Explain the decision, what evidence you relied on, and how the amounts were chosen…"
            className="mt-1 dark:bg-gray-900"
          />
        </div>

        {state?.ok === false ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state?.ok === true ? (
          <Alert className="border-emerald-300/60 bg-emerald-50/80 py-2 dark:border-emerald-800 dark:bg-emerald-950/30">
            <AlertDescription className="text-xs text-emerald-950 dark:text-emerald-100">
              {state.success}
            </AlertDescription>
          </Alert>
        ) : null}

        <MediationSubmitButton binding={binding} />
      </form>
    </div>
  );
}
