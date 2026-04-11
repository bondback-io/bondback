import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildJobListingMetadata } from "@/lib/seo/jobs-listings-seo";
import { fieldsFromPostgrestError, logSystemError } from "@/lib/system-error-log";
import { JobDetailPageContent } from "@/app/jobs/job-detail-page-content";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const JOB_RLS_GATE_SELECT = "id, listing_id";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    return await buildJobListingMetadata(resolvedParams.id, {
      canonical: "jobs",
    });
  } catch (e) {
    console.error("[jobs/[id]] generateMetadata failed", e);
    return { title: "Job · Bond Back", robots: { index: false, follow: true } };
  }
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const raw = resolvedParams.id.trim();

  if (!/^\d+$/.test(raw)) {
    if (UUID_RE.test(raw)) {
      await logSystemError({
        source: "job_detail:route",
        severity: "warning",
        routePath: "/jobs/[id]",
        message:
          "Opened /jobs/[id] with a listing UUID — redirecting to /listings/[id]. Job detail URLs use numeric job IDs only.",
        context: { routeParam: raw, redirect_to: `/listings/${raw}` },
      });
      redirect(`/listings/${encodeURIComponent(raw)}`);
    }
    notFound();
  }

  const numericId = parseInt(raw, 10);
  if (!Number.isFinite(numericId)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const sessionUserId = authUser?.id ?? null;

  const admin = createSupabaseAdminClient();

  const [userRes, adminRes] = await Promise.all([
    supabase
      .from("jobs")
      .select(JOB_RLS_GATE_SELECT)
      .eq("id", numericId)
      .maybeSingle(),
    admin
      ? admin
          .from("jobs")
          .select(JOB_RLS_GATE_SELECT)
          .eq("id", numericId)
          .maybeSingle()
      : Promise.resolve({
          data: null as { id: number; listing_id: string } | null,
          error: null,
        }),
  ]);

  if (userRes.error) {
    console.error("[jobs/[id]] user jobs query error:", userRes.error.message, userRes.error.code);
    await logSystemError({
      source: "job_detail:rls_gate",
      severity: "error",
      routePath: "/jobs/[id]",
      jobId: numericId,
      userId: sessionUserId,
      context: { phase: "jobs_user_rls_gate", routeParam: raw },
      ...fieldsFromPostgrestError(userRes.error),
    });
  }
  if (adminRes.error) {
    console.error("[jobs/[id]] admin jobs query error:", adminRes.error.message);
  }

  const userSawRow = !!userRes.data;
  const adminSawRow = !!adminRes.data;
  const listingIdForHint = adminRes.data?.listing_id ?? null;

  if (!adminSawRow) {
    if (!admin) {
      await logSystemError({
        source: "job_detail:rls_gate",
        severity: "warning",
        routePath: "/jobs/[id]",
        jobId: numericId,
        userId: sessionUserId,
        message:
          "Cannot verify job existence: service role not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
        context: { routeParam: raw, user_saw_row: userSawRow },
      });
    }
    if (!userSawRow) {
      notFound();
    }
  }

  if (!userSawRow && adminSawRow) {
    await logSystemError({
      source: "job_detail:rls_gate",
      severity: "warning",
      routePath: "/jobs/[id]",
      jobId: numericId,
      listingId: listingIdForHint,
      userId: sessionUserId,
      message:
        "Job row exists but user session cannot SELECT it (RLS). User may be a bidder/lister/winner not covered by current policies.",
      context: {
        routeParam: raw,
        user_saw_row: userSawRow,
        admin_saw_row: adminSawRow,
        supabase_service_role_configured: !!admin,
      },
    });

    return (
      <div className="mx-auto max-w-4xl p-10 text-center">
        <h1 className="mb-4 text-3xl font-bold text-foreground">Job not visible</h1>
        <p className="mx-auto max-w-lg text-muted-foreground">
          This job exists, but your account can&apos;t open it with the current rules (for example
          you may need to be the lister, the assigned cleaner, or a bidder on this auction). If the
          listing is still in bidding or live, try the listing page instead.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {listingIdForHint ? (
            <Button className="rounded-xl" asChild>
              <Link href={`/listings/${encodeURIComponent(listingIdForHint)}`}>
                View listing
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" className="rounded-xl" asChild>
            <Link href="/jobs">Browse jobs</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <JobDetailPageContent
      params={params}
      searchParams={searchParams}
      mode="jobs"
    />
  );
}
