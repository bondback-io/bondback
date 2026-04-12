import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { buildJobListingMetadata } from "@/lib/seo/jobs-listings-seo";
import { logSystemError } from "@/lib/system-error-log";
import { loadJobByNumericIdForSession } from "@/lib/jobs/load-job-for-detail-route";
import { buildJobRouteDebugSnapshot } from "@/lib/jobs/job-route-debug";
import { JobDetailPageContent } from "@/app/jobs/job-detail-page-content";
import { JobRouteDebugPanel } from "@/app/jobs/[id]/job-route-debug-panel";

function firstSearchParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const sp = (await searchParams) ?? {};
  const debugMode =
    firstSearchParam(sp.debug) === "1" || firstSearchParam(sp.debug) === "true";

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

  /**
   * Single source of truth: same loader as SEO + `JobDetailPageContent`.
   * The old RLS-only gate treated “user cannot SELECT jobs” as 404 even when the linked listing
   * was marketplace-visible (cleaners browsing live auctions).
   */
  const job = await loadJobByNumericIdForSession(
    supabase,
    numericId,
    sessionUserId ?? undefined
  );

  if (!job) {
    if (debugMode) {
      const payload = await buildJobRouteDebugSnapshot(supabase, numericId, raw, sessionUserId);
      return <JobRouteDebugPanel payload={payload} />;
    }
    notFound();
  }

  return (
    <JobDetailPageContent
      params={params}
      searchParams={searchParams}
      mode="jobs"
    />
  );
}
