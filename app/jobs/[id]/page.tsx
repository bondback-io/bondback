import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { buildJobListingMetadata } from "@/lib/seo/jobs-listings-seo";
import { logSystemError } from "@/lib/system-error-log";
import { JobDetailPageContent } from "@/app/jobs/job-detail-page-content";

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
    const { notFound } = await import("next/navigation");
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
