import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { AdminDisputeJobConsole } from "@/components/admin/admin-dispute-job-console";
import { AdminPurgeDisputeButton } from "@/components/admin/admin-purge-dispute-button";
import { serializeDisputeMessagesForClient } from "@/lib/disputes/serialize-dispute-messages";
import { mergeOpeningMessageFromJobIfMissing } from "@/lib/disputes/dispute-audit-merge";

export const dynamic = "force-dynamic";

const JOB_SELECT =
  "id, lister_id, winner_id, status, dispute_status, dispute_opened_by, dispute_reason, dispute_priority, dispute_escalated, dispute_mediation_status, mediation_proposal, proposed_refund_amount, counter_proposal_amount, created_at, updated_at, disputed_at, dispute_photos, dispute_evidence, agreed_amount_cents, admin_mediation_requested, admin_mediation_requested_at, dispute_cleaner_counter_used, dispute_lister_counter_used, dispute_resolution, resolution_at";

function backToQueueHref(sp?: Record<string, string | string[] | undefined>): string {
  if (!sp || Object.keys(sp).length === 0) return "/admin/disputes";
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries(sp)) {
    if (val == null) continue;
    if (Array.isArray(val)) val.forEach((v) => p.append(k, String(v)));
    else p.set(k, String(val));
  }
  const qs = p.toString();
  return qs ? `/admin/disputes?${qs}` : "/admin/disputes";
}

export default async function AdminDisputeJobConsolePage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { jobId: jobIdParam } = await params;
  const numericId = Number(jobIdParam);
  if (!Number.isFinite(numericId) || numericId < 1) notFound();

  const sp = (await searchParams) ?? {};
  const backHref = backToQueueHref(sp);

  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profileData || !(profileData as { is_admin?: boolean }).is_admin) {
    redirect("/dashboard");
  }

  const admin = createSupabaseAdminClient();
  const db = (admin ?? supabase) as any;

  const { data: jobRow, error: jobError } = await db.from("jobs").select(JOB_SELECT).eq("id", numericId).maybeSingle();

  if (jobError || !jobRow) notFound();

  const job = jobRow as { disputed_at?: string | null; lister_id: string; winner_id: string | null };

  if (!job.disputed_at) {
    redirect(backHref);
  }

  let messages = [] as ReturnType<typeof serializeDisputeMessagesForClient>;
  if (admin) {
    const { data: msgs } = await admin
      .from("dispute_messages")
      .select("*")
      .eq("job_id", numericId)
      .order("created_at", { ascending: true });
    messages = serializeDisputeMessagesForClient(msgs ?? []);
  }

  const auditMessages = mergeOpeningMessageFromJobIfMissing(jobRow, messages);

  const userIds = [job.lister_id, job.winner_id].filter(Boolean) as string[];
  let lister: { full_name: string | null; profile_photo_url: string | null } | null = null;
  let cleaner: { full_name: string | null; profile_photo_url: string | null } | null = null;

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, profile_photo_url")
      .in("id", userIds);
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    lister = pmap.get(job.lister_id) ?? null;
    cleaner = job.winner_id ? pmap.get(job.winner_id) ?? null : null;
  }

  return (
    <AdminShell activeHref="/admin/disputes">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
              Dispute console — job #{numericId}
            </h1>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Mediation, resolution, audit trail, and party emails for this dispute.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={backHref}>Back to queue</Link>
            </Button>
            <AdminPurgeDisputeButton jobId={numericId} variant="detail" />
          </div>
        </div>

        <AdminDisputeJobConsole
          job={jobRow as { id: number; status?: string } & Record<string, unknown>}
          lister={lister}
          cleaner={cleaner}
          auditMessages={auditMessages}
        />
      </div>
    </AdminShell>
  );
}
