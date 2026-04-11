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

/** User client: minimal columns (RLS test). */
const JOB_USER_SELECT =
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

  const admin = createSupabaseAdminClient();

  // Parallel: user (RLS) vs service role (bypass) — strongest RLS diagnostic
  const [userRes, adminRes] = await Promise.all([
    supabase.from("jobs").select(JOB_USER_SELECT).eq("id", numericId).maybeSingle(),
    admin
      ? admin.from("jobs").select("*").eq("id", numericId).maybeSingle()
      : Promise.resolve({ data: null as JobRow | null, error: null }),
  ]);

  const userSawRow = !!userRes.data;
  const adminSawRow = !!adminRes.data;
  const rlsLikelyBlocking = !userSawRow && adminSawRow;

  if (userRes.error) {
    console.error("[jobs/[id]] user jobs query error:", userRes.error.message, userRes.error.code);
  }
  if (adminRes.error) {
    console.error("[jobs/[id]] service role jobs query error:", adminRes.error.message);
  }

  if (userRes.error && !adminSawRow) {
    await logSystemError({
      source: "job_detail:jobs",
      severity: "error",
      routePath: "/jobs/[id]",
      jobId: numericId,
      userId: sessionUserId,
      context: { routeParam: raw, phase: "jobs_user", admin_saw_row: adminSawRow },
      ...fieldsFromPostgrestError(userRes.error),
    });
    return (
      <div className="max-w-4xl mx-auto p-10 text-center">
        <h1 className="text-3xl font-bold mb-4 text-red-400">Error loading job</h1>
        <p className="text-muted-foreground font-mono text-sm">{userRes.error.message}</p>
      </div>
    );
  }

  const job = (userRes.data ?? adminRes.data) as JobRow | null;
  const usedServiceRoleFallback = !userSawRow && adminSawRow;

  if (!job) {
    await logSystemError({
      source: "job_detail:jobs",
      severity: "warning",
      routePath: "/jobs/[id]",
      jobId: numericId,
      userId: sessionUserId,
      message: "No job row for user or service role — invalid id or DB error.",
      context: {
        routeParam: raw,
        user_saw_row: userSawRow,
        admin_saw_row: adminSawRow,
        supabase_service_role_configured: !!admin,
      },
    });

    return (
      <div className="max-w-4xl mx-auto p-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-foreground">Job not found</h1>
          <p className="text-muted-foreground mb-2">Job ID: {numericId}</p>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm mb-6">
            No row for this id with your session or with the service role. The id may be wrong, or
            the job was removed.
          </p>
          <Button className="rounded-xl" asChild>
            <Link href="/jobs">Browse jobs</Link>
          </Button>
        </div>

        <DiagnosticBlock
          raw={raw}
          numericId={numericId}
          sessionUserId={sessionUserId}
          adminConfigured={!!admin}
          userSawRow={userSawRow}
          adminSawRow={adminSawRow}
          userError={userRes.error?.message ?? null}
          adminError={adminRes.error?.message ?? null}
        />
      </div>
    );
  }

  if (usedServiceRoleFallback) {
    console.warn("[jobs/[id]] User SELECT returned no row; service role has row (RLS)", {
      jobId: numericId,
      userId: sessionUserId,
    });
  }

  console.log("✅ Job resolved:", job.id, job.status, {
    lister_id: job.lister_id,
    winner_id: job.winner_id ?? null,
    userId: sessionUserId ?? "(anonymous)",
    userSawRow,
    adminSawRow,
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
    await logSystemError({
      source: "job_detail:listings",
      severity: "warning",
      routePath: "/jobs/[id]",
      jobId: job.id,
      listingId: job.listing_id,
      userId: sessionUserId,
      context: {
        routeParam: raw,
        job_status: job.status,
        usedServiceRoleFallback,
      },
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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <DiagnosticBlock
        raw={raw}
        numericId={numericId}
        sessionUserId={sessionUserId}
        adminConfigured={!!admin}
        userSawRow={userSawRow}
        adminSawRow={adminSawRow}
        userError={userRes.error?.message ?? null}
        adminError={adminRes.error?.message ?? null}
      />

      {usedServiceRoleFallback ? (
        <p className="text-xs text-amber-600 dark:text-amber-400/90 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2">
          <strong>RLS:</strong> Your session could not SELECT this job row; the page used the
          service-role read. Apply{" "}
          <code className="rounded bg-muted px-1">docs/JOBS_LISTINGS_RLS_PARTY_SELECT.sql</code> so
          listers/bidders/winners can read without bypass.
        </p>
      ) : null}

      {rlsLikelyBlocking ? (
        <p className="text-xs text-blue-600 dark:text-blue-400 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2">
          Diagnostic: <code>user_saw_row=false</code> and <code>service_role_saw_row=true</code> →
          policies blocked the user client for this id.
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

function DiagnosticBlock({
  raw,
  numericId,
  sessionUserId,
  adminConfigured,
  userSawRow,
  adminSawRow,
  userError,
  adminError,
}: {
  raw: string;
  numericId: number;
  sessionUserId: string | null;
  adminConfigured: boolean;
  userSawRow: boolean;
  adminSawRow: boolean;
  userError: string | null;
  adminError: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4 text-left text-sm">
      <p className="font-semibold text-foreground mb-2">RLS diagnostic</p>
      <ul className="space-y-1.5 font-mono text-[11px] text-muted-foreground break-all">
        <li>
          <span className="text-foreground">route id:</span> {raw} → <span className="text-foreground">parsed:</span>{" "}
          {numericId}
        </li>
        <li>
          <span className="text-foreground">auth.uid():</span> {sessionUserId ?? "(not signed in)"}
        </li>
        <li>
          <span className="text-foreground">user client row:</span> {userSawRow ? "yes" : "no"}
          {userError ? ` (error: ${userError})` : ""}
        </li>
        <li>
          <span className="text-foreground">service role row:</span>{" "}
          {!adminConfigured ? "not queried (SUPABASE_SERVICE_ROLE_KEY missing)" : adminSawRow ? "yes" : "no"}
          {adminError ? ` (error: ${adminError})` : ""}
        </li>
        <li>
          <span className="text-foreground">verdict:</span>{" "}
          {!adminConfigured
            ? "Set service role on server to compare RLS vs DB truth."
            : !userSawRow && adminSawRow
              ? "RLS is hiding this row from the user client."
              : userSawRow && adminSawRow
                ? "User and service role both see the row."
                : !userSawRow && !adminSawRow
                  ? "No row for this id (or both queries failed)."
                  : "User sees row."}
        </li>
      </ul>
    </div>
  );
}
