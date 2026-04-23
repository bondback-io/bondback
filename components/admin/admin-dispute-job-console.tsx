import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { proposeMediation } from "@/lib/actions/disputes";
import { DisputeJobCaseSummary, type DisputeJobCaseJobFields } from "@/components/disputes/dispute-job-case-summary";
import { DisputeAuditTimeline } from "@/components/disputes/dispute-audit-timeline";
import type { SerializableDisputeMessage } from "@/lib/disputes/serialize-dispute-messages";
import { AdminDisputePartyEmailForms } from "@/components/admin/admin-dispute-party-email-forms";
import { AdminDisputeResolvePanel } from "@/components/admin/admin-dispute-resolve-panel";
import { AdminDisputeCaseNoteForm } from "@/components/admin/admin-dispute-case-note-form";

type Profile = { full_name: string | null; profile_photo_url: string | null };

export function AdminDisputeJobConsole({
  job,
  lister,
  cleaner,
  auditMessages,
}: {
  job: Record<string, unknown> & { id: number | string; status?: string };
  lister: Profile | null | undefined;
  cleaner: Profile | null | undefined;
  auditMessages: SerializableDisputeMessage[];
}) {
  const suggestedRefund =
    Math.max(0, Number(job.counter_proposal_amount ?? 0)) ||
    Math.max(0, Number(job.proposed_refund_amount ?? 0));
  const agreed = Math.max(0, Number(job.agreed_amount_cents ?? 0));
  /** Cleaner reject / lister decline / cron escalation may set in_review without the explicit flag on older rows. */
  const adminReviewFlagged =
    Boolean(job.admin_mediation_requested) ||
    Boolean(job.dispute_escalated) ||
    (String(job.status ?? "") === "in_review" && Number(job.proposed_refund_amount ?? 0) > 0);

  return (
    <Card className="border-border dark:border-gray-800 dark:bg-gray-900/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">Job #{job.id}</p>
          <Badge variant="outline">{String(job.status ?? "")}</Badge>
          {job.dispute_status ? (
            <Badge variant="secondary" className="text-[10px] capitalize">
              dispute: {String(job.dispute_status).replace(/_/g, " ")}
            </Badge>
          ) : null}
          <Badge variant="secondary">{String(job.dispute_priority ?? "medium")}</Badge>
          {job.dispute_escalated ? <Badge className="bg-red-600 text-white">Escalated</Badge> : null}
          {job.dispute_mediation_status && job.dispute_mediation_status !== "none" ? (
            <Badge className="bg-violet-600 text-white">Mediation: {String(job.dispute_mediation_status)}</Badge>
          ) : null}
          {job.dispute_resolution ? (
            <Badge className="border border-emerald-600/50 bg-emerald-950/40 text-emerald-100">
              Outcome: {String(job.dispute_resolution).replace(/_/g, " ")}
            </Badge>
          ) : null}
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <Link href={`/jobs/${job.id}#dispute`} target="_blank" rel="noopener noreferrer">
              Open job
            </Link>
          </Button>
        </div>
        {job.resolution_at ? (
          <p className="text-[11px] text-muted-foreground">
            Resolution recorded: {new Date(String(job.resolution_at)).toLocaleString()}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {lister?.full_name ?? "Lister"} vs {cleaner?.full_name ?? "Cleaner"}
        </p>

        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`admin-med-${job.id}`}
              checked={adminReviewFlagged}
              disabled
              aria-readonly
            />
            <Label htmlFor={`admin-med-${job.id}`} className="text-xs font-normal cursor-default">
              Admin review / mediation flagged
            </Label>
          </div>
          {job.admin_mediation_requested_at ? (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Mediation requested: {new Date(String(job.admin_mediation_requested_at)).toLocaleString()}
            </span>
          ) : adminReviewFlagged ? (
            <span className="text-[11px] text-muted-foreground">
              Escalated or in review — see status and thread (timestamp may be missing on older jobs).
            </span>
          ) : null}
          {job.dispute_cleaner_counter_used ? (
            <Badge variant="outline" className="text-[10px]">
              Cleaner counter used
            </Badge>
          ) : null}
          {job.dispute_lister_counter_used ? (
            <Badge variant="outline" className="text-[10px]">
              Lister counter used
            </Badge>
          ) : null}
        </div>

        <DisputeJobCaseSummary job={job as DisputeJobCaseJobFields} />
        <AdminDisputeCaseNoteForm jobId={Number(job.id)} />
        <DisputeAuditTimeline jobId={Number(job.id)} messages={auditMessages} isAdminConsole />

        <AdminDisputeResolvePanel
          jobId={Number(job.id)}
          jobStatus={String(job.status ?? "")}
          suggestedRefundCents={suggestedRefund}
          agreedAmountCents={agreed}
        />

        <AdminDisputePartyEmailForms jobId={Number(job.id)} />

        <form
          action={proposeMediation}
          className="grid gap-2 rounded-lg border border-violet-300/70 bg-violet-50/70 p-3 dark:border-violet-800 dark:bg-violet-950/20"
        >
          <input type="hidden" name="jobId" value={String(job.id)} />
          <Label className="text-xs">Mediation proposal</Label>
          <Textarea name="proposalText" rows={2} required placeholder="Propose a fair settlement..." />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input name="refundCents" type="number" min={0} step={50} placeholder="Refund cents (optional)" />
            <Input
              name="additionalPaymentCents"
              type="number"
              min={0}
              step={50}
              placeholder="Top-up cents (optional)"
            />
          </div>
          <Button type="submit" size="sm" className="w-fit">
            Send mediation proposal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
