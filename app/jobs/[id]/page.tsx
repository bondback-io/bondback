import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  fieldsFromPostgrestError,
  logSystemError,
} from "@/lib/system-error-log";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

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

/**
 * Job detail: graceful handling when RLS returns no row (live/bidding / wrong role).
 * `jobs` has no address/rooms/description/price — those come from `listings`.
 * Assigned cleaner is `winner_id` (not `cleaner_id`).
 */
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

  const { data: jobRaw, error } = await supabase
    .from("jobs")
    .select(
      "id, title, status, lister_id, winner_id, agreed_amount_cents, listing_id, created_at, updated_at"
    )
    .eq("id", numericId)
    .maybeSingle();

  if (error) {
    console.error("[jobs/[id]] Supabase jobs query error:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      jobId: numericId,
      userId: sessionUserId ?? "(anonymous)",
    });
    await logSystemError({
      source: "job_detail:jobs",
      severity: "error",
      routePath: "/jobs/[id]",
      jobId: numericId,
      userId: sessionUserId,
      context: { routeParam: raw, phase: "jobs_select" },
      ...fieldsFromPostgrestError(error),
    });
    notFound();
  }

  if (!jobRaw) {
    console.error(
      "[jobs/[id]] No job row returned — likely RLS (no error) or invalid id. userId:",
      sessionUserId ?? "(anonymous)",
      "jobId:",
      numericId
    );
    await logSystemError({
      source: "job_detail:jobs",
      severity: "warning",
      routePath: "/jobs/[id]",
      jobId: numericId,
      userId: sessionUserId,
      message:
        "No row returned (null) without PostgREST error — often RLS hiding the row, or invalid job id.",
      context: {
        routeParam: raw,
        note: "maybeSingle returned null",
        hint: "Apply docs/JOBS_LISTINGS_RLS_PARTY_SELECT.sql if lister/bidder/winner should see this job.",
      },
    });

    return (
      <div className="max-w-4xl mx-auto p-10 text-center">
        <h1 className="text-3xl font-bold mb-4 text-foreground">Job not visible</h1>
        <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
          We couldn&apos;t load this job with your account. It may still be in bidding or live
          status, and only the lister, bidders, or assigned cleaner can open it — or the link may
          be wrong.
        </p>
        <Button className="mt-8 rounded-xl" asChild>
          <Link href="/jobs">Browse jobs</Link>
        </Button>
      </div>
    );
  }

  const job = jobRaw as JobRow;

  console.log("✅ Job loaded:", job.id, job.status, {
    lister_id: job.lister_id,
    winner_id: job.winner_id ?? null,
    userId: sessionUserId ?? "(anonymous)",
  });

  const [{ data: listerProfile }, { data: winnerProfile }, listingRes] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", job.lister_id).maybeSingle(),
    job.winner_id
      ? supabase.from("profiles").select("full_name").eq("id", job.winner_id).maybeSingle()
      : Promise.resolve({ data: null as { full_name: string | null } | null }),
    supabase
      .from("listings")
      .select(
        "description, suburb, postcode, bedrooms, bathrooms, buy_now_cents, reserve_cents"
      )
      .eq("id", job.listing_id)
      .maybeSingle(),
  ]);

  const listingError = listingRes.error;
  const listingRaw = listingRes.data;

  if (listingError) {
    console.error("[jobs/[id]] listing query error:", {
      message: listingError.message,
      code: listingError.code,
      listing_id: job.listing_id,
      userId: sessionUserId,
    });
    await logSystemError({
      source: "job_detail:listings",
      severity: "warning",
      routePath: "/jobs/[id]",
      jobId: job.id,
      listingId: job.listing_id,
      userId: sessionUserId,
      context: { routeParam: raw, job_status: job.status },
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

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
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
