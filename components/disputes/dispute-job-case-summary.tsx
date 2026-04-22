import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/listings";
import { disputeOpenerRole } from "@/lib/jobs/dispute-opened-by";
import { coerceDisputePhotoUrls } from "@/lib/disputes/coerce-dispute-photo-urls";

export type DisputeJobCaseJobFields = {
  id: number;
  lister_id: string;
  winner_id: string | null;
  status: string;
  disputed_at?: string | null;
  dispute_reason?: string | null;
  dispute_photos?: string[] | null;
  dispute_evidence?: string[] | null;
  dispute_status?: string | null;
  dispute_opened_by?: string | null;
  proposed_refund_amount?: number | null;
  counter_proposal_amount?: number | null;
  agreed_amount_cents?: number | null;
};

const ACTIVE_DISPUTE_STATUSES = new Set(["disputed", "dispute_negotiating", "in_review"]);

function shouldShowDisputeCase(job: DisputeJobCaseJobFields): boolean {
  if (ACTIVE_DISPUTE_STATUSES.has(String(job.status ?? ""))) return true;
  if (String(job.dispute_reason ?? "").trim()) return true;
  if (job.disputed_at) return true;
  return false;
}

/**
 * Summary of the formal dispute stored on `jobs` (reason, evidence, refund figures).
 * The separate `dispute_messages` thread is optional discussion; this is the case record.
 */
export function DisputeJobCaseSummary({ job }: { job: DisputeJobCaseJobFields }) {
  if (!shouldShowDisputeCase(job)) return null;

  const evidenceUrls = coerceDisputePhotoUrls(
    job.dispute_evidence,
    job.dispute_photos
  ).slice(0, 12);

  const opener = disputeOpenerRole({
    dispute_opened_by: job.dispute_opened_by,
    lister_id: job.lister_id,
    winner_id: job.winner_id,
  });
  const openerLabel =
    opener === "lister"
      ? "Opened by lister"
      : opener === "cleaner"
        ? "Opened by cleaner"
        : null;

  const agreed = Math.max(0, Number(job.agreed_amount_cents ?? 0));
  const proposed = Math.max(0, Number(job.proposed_refund_amount ?? 0));
  const counter = Math.max(0, Number(job.counter_proposal_amount ?? 0));

  return (
    <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/25">
      <CardHeader className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">Dispute case</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            {job.dispute_status ? (
              <Badge variant="outline" className="text-[11px] capitalize">
                {String(job.dispute_status).replace(/_/g, " ")}
              </Badge>
            ) : null}
          </div>
        </div>
        {job.disputed_at ? (
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Opened {new Date(job.disputed_at).toLocaleString()}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {openerLabel ? (
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">{openerLabel}</p>
        ) : null}
        {job.dispute_reason?.trim() ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-500">
              Reason &amp; details
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground dark:text-gray-100">
              {job.dispute_reason.trim()}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            No written reason is stored for this dispute yet. Use the job page for the full workflow (evidence,
            responses, refunds).
          </p>
        )}

        {evidenceUrls.length > 0 ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-500">
              Evidence photos
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {evidenceUrls.map((url) => (
                <li
                  key={url}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted dark:border-gray-600"
                >
                  <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element -- small thumbnails; remote Supabase URLs */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {(proposed > 0 || counter > 0) && (
          <div className="rounded-lg border border-amber-200/60 bg-white/50 p-3 text-sm dark:border-amber-900 dark:bg-gray-900/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-500">
              Refund negotiation
            </p>
            {proposed > 0 ? (
              <p className="mt-1 text-foreground dark:text-gray-100">
                Amount to return to lister: <strong>{formatCents(proposed)}</strong>
                {agreed > 0 ? <> (agreed job payment {formatCents(agreed)})</> : null}
              </p>
            ) : null}
            {counter > 0 ? (
              <p className="mt-1 text-foreground dark:text-gray-100">
                Cleaner counter (refund to lister): <strong>{formatCents(counter)}</strong>
              </p>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link href={`/disputes/${job.id}`}>Dispute case &amp; timeline</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
            <Link href={`/jobs/${job.id}#dispute`}>Manage on job page</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
