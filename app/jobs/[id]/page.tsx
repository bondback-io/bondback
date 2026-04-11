import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fieldsFromPostgrestError,
  logSystemError,
} from "@/lib/system-error-log";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

/** No joins — smallest column set for `jobs` (real columns only). */
const JOB_MINIMAL_SELECT =
  "id, title, status, lister_id, winner_id, agreed_amount_cents, listing_id, created_at, updated_at";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

type ListingExtras = Pick<
  Database["public"]["Tables"]["listings"]["Row"],
  | "description"
  | "suburb"
  | "postcode"
  | "bedrooms"
  | "bathrooms"
  | "buy_now_cents"
  | "reserve_cents"
>;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const raw = resolvedParams.id.trim();

  console.log("🚀 Job detail route hit for ID:", raw);

  const numericId = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(numericId)) {
    console.warn("[jobs/[id]] invalid route param (non-numeric):", raw);
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const sessionUserId = authUser?.id ?? null;

  // 1) User-scoped client — minimal select, no joins
  const { data: jobUser, error: jobError } = await supabase
    .from("jobs")
    .select(JOB_MINIMAL_SELECT)
    .eq("id", numericId)
    .maybeSingle();

  if (jobError) {
    console.error("[jobs/[id]] Supabase jobs query error:", {
      message: jobError.message,
      code: jobError.code,
      details: jobError.details,
      hint: jobError.hint,
      jobId: numericId,
      userId: sessionUserId ?? "(anonymous)",
    });
    await logSystemError({
      source: "job_detail:jobs",
      severity: "error",
      routePath: "/jobs/[id]",
      jobId: numericId,
      userId: sessionUserId,
      context: { routeParam: raw, phase: "jobs_select_user" },
      ...fieldsFromPostgrestError(jobError),
    });
    return (
      <div className="max-w-4xl mx-auto p-10 text-center">
        <h1 className="text-3xl font-bold mb-4 text-red-400">Error loading job</h1>
        <p className="text-muted-foreground font-mono text-sm">{jobError.message}</p>
        {jobError.code ? (
          <p className="mt-4 text-xs text-muted-foreground">code: {jobError.code}</p>
        ) : null}
      </div>
    );
  }

  let job = jobUser as JobRow | null;
  let usedServiceRoleFallback = false;
  const admin = createSupabaseAdminClient();
  /** Whether a row exists for this id when read with service role (null = not checked or error). */
  let serviceRoleRowExists: boolean | null = null;

  // 2) RLS returned no row — try service role read (same minimal select) for display
  if (!job && admin) {
    const { data: jobAdmin, error: adminJobErr } = await admin
      .from("jobs")
      .select(JOB_MINIMAL_SELECT)
      .eq("id", numericId)
      .maybeSingle();

    if (adminJobErr) {
      console.error("[jobs/[id]] admin jobs read failed:", adminJobErr.message);
      serviceRoleRowExists = null;
    } else {
      serviceRoleRowExists = !!jobAdmin;
      if (jobAdmin) {
        job = jobAdmin as JobRow;
        usedServiceRoleFallback = true;
        console.warn("[jobs/[id]] User client returned no row; loaded job via service role", {
          jobId: numericId,
          userId: sessionUserId,
        });
      }
    }
  }

  if (!job) {
    const dbHasJobRow = admin ? serviceRoleRowExists : null;

    console.error("[jobs/[id]] No job visible after user + admin fallback:", {
      jobId: numericId,
      userId: sessionUserId ?? "(anonymous)",
      dbHasJobRow,
      serviceRoleConfigured: !!admin,
    });

    await logSystemError({
      source: "job_detail:jobs",
      severity: "warning",
      routePath: "/jobs/[id]",
      jobId: numericId,
      userId: sessionUserId,
      message:
        "No job row for user; admin fallback empty or missing — RLS, invalid id, or no service role.",
      context: {
        routeParam: raw,
        db_has_row_service_role: dbHasJobRow,
        supabase_service_role_configured: !!admin,
      },
    });

    return (
      <div className="max-w-4xl mx-auto p-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-foreground">Job not visible</h1>
          <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed mb-6">
            We couldn&apos;t load this job with your account. If RLS policies are still tightening,
            only the lister, a bidder, or the assigned cleaner may see it — or this id may not
            exist.
          </p>
          <Button className="rounded-xl" asChild>
            <Link href="/jobs">Browse jobs</Link>
          </Button>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 text-left text-sm">
          <p className="font-semibold text-foreground mb-3">Debug</p>
          <ul className="space-y-2 font-mono text-xs text-muted-foreground break-all">
            <li>
              <span className="text-foreground">route id:</span> {raw}
            </li>
            <li>
              <span className="text-foreground">parsed job id:</span> {numericId}
            </li>
            <li>
              <span className="text-foreground">auth.uid():</span>{" "}
              {sessionUserId ?? "(not signed in)"}
            </li>
            <li>
              <span className="text-foreground">user client row:</span> none (RLS or missing)
            </li>
            <li>
              <span className="text-foreground">SUPABASE_SERVICE_ROLE_KEY:</span>{" "}
              {admin ? "set (fallback attempted)" : "missing — add on server for bypass read"}
            </li>
            <li>
              <span className="text-foreground">row exists (service role):</span>{" "}
              {dbHasJobRow === null
                ? "unknown (admin read failed or not run)"
                : dbHasJobRow
                  ? "yes — user SELECT blocked by RLS"
                  : "no — no row for this id"}
            </li>
          </ul>
        </div>
      </div>
    );
  }

  console.log("✅ Job loaded:", job.id, job.status, {
    lister_id: job.lister_id,
    winner_id: job.winner_id ?? null,
    userId: sessionUserId ?? "(anonymous)",
    usedServiceRoleFallback,
  });

  const [{ data: listerProfile }, { data: winnerProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", job.lister_id).maybeSingle(),
    job.winner_id
      ? supabase.from("profiles").select("full_name").eq("id", job.winner_id).maybeSingle()
      : Promise.resolve({ data: null as { full_name: string | null } | null }),
  ]);

  const listingRes =
    usedServiceRoleFallback && admin
      ? await admin
          .from("listings")
          .select(
            "description, suburb, postcode, bedrooms, bathrooms, buy_now_cents, reserve_cents"
          )
          .eq("id", job.listing_id)
          .maybeSingle()
      : await supabase
          .from("listings")
          .select(
            "description, suburb, postcode, bedrooms, bathrooms, buy_now_cents, reserve_cents"
          )
          .eq("id", job.listing_id)
          .maybeSingle();

  const listingError = listingRes.error;
  const listingRaw = listingRes.data;

  if (listingError) {
    console.error("[jobs/[id]] listing query error:", {
      message: listingError.message,
      code: listingError.code,
      listing_id: job.listing_id,
      userId: sessionUserId,
      usedServiceRoleFallback,
    });
    await logSystemError({
      source: "job_detail:listings",
      severity: "warning",
      routePath: "/jobs/[id]",
      jobId: job.id,
      listingId: job.listing_id,
      userId: sessionUserId,
      context: { routeParam: raw, job_status: job.status, usedServiceRoleFallback },
      ...fieldsFromPostgrestError(listingError),
    });
    return (
      <div className="max-w-4xl mx-auto p-10">
        <div className="bg-amber-500/10 border border-amber-500 rounded-3xl p-10 text-amber-200">
          <h1 className="text-3xl font-bold mb-4">Job loaded — listing unavailable</h1>
          <p className="mb-4 text-sm">
            Job ID: {job.id} · listing_id: {job.listing_id}
          </p>
          <p className="font-mono text-sm whitespace-pre-wrap">{listingError.message}</p>
        </div>
      </div>
    );
  }

  const listing = listingRaw as ListingExtras | null;

  const address =
    listing != null ? `${listing.suburb} ${listing.postcode}` : "—";
  const priceDollars =
    job.agreed_amount_cents != null && job.agreed_amount_cents > 0
      ? (job.agreed_amount_cents / 100).toFixed(2)
      : listing != null
        ? ((listing.buy_now_cents ?? listing.reserve_cents) / 100).toFixed(2)
        : "0";

  const listerName = (listerProfile as { full_name: string | null } | null)?.full_name ?? null;
  const winnerName = (winnerProfile as { full_name: string | null } | null)?.full_name ?? null;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {usedServiceRoleFallback ? (
        <p className="text-xs text-amber-600 dark:text-amber-400/90 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2">
          Loaded with service role because your user session could not read this job row (RLS).
          Fix policies in{" "}
          <code className="rounded bg-muted px-1">docs/JOBS_LISTINGS_RLS_PARTY_SELECT.sql</code> so
          listers/bidders/winners can SELECT without bypass.
        </p>
      ) : null}

      <div className="bg-card border rounded-3xl p-10">
        <h1 className="text-4xl font-bold">{job.title ?? "Job"}</h1>
        <p className="text-muted-foreground mt-2">
          Status: {job.status} · ID: {job.id}
        </p>
        {(listerName || winnerName) && (
          <p className="text-sm text-muted-foreground mt-3">
            {listerName ? <>Lister: {listerName}</> : null}
            {listerName && winnerName ? " · " : null}
            {winnerName ? <>Assigned cleaner: {winnerName}</> : null}
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 text-lg">
          <div>
            <strong>Address:</strong> {address}
          </div>
          <div>
            <strong>Bedrooms:</strong> {listing?.bedrooms ?? "—"}
          </div>
          <div>
            <strong>Bathrooms:</strong> {listing?.bathrooms ?? "—"}
          </div>
          <div>
            <strong>Price:</strong> ${priceDollars}
          </div>
        </div>

        <div className="mt-10">
          <h2 className="font-semibold mb-3 text-lg">Description</h2>
          <p className="whitespace-pre-wrap text-foreground leading-relaxed">
            {listing?.description ?? "No description."}
          </p>
        </div>
      </div>
    </div>
  );
}
