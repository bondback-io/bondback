import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type JobRow = Pick<
  Database["public"]["Tables"]["jobs"]["Row"],
  | "id"
  | "title"
  | "status"
  | "lister_id"
  | "winner_id"
  | "agreed_amount_cents"
  | "listing_id"
  | "created_at"
>;

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
 * Job detail diagnostic: surfaces PostgREST/RLS errors on the page (not only in server logs).
 * `jobs` has no description/address/rooms/price — merged from `listings` when the job row loads.
 */
export default async function JobDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const raw = resolvedParams.id.trim();

  console.log("🚀 [Job Detail Diagnostic] Starting for ID:", raw);

  const numericId = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(numericId)) {
    return (
      <div className="max-w-4xl mx-auto p-10">
        <div className="bg-red-500/10 border border-red-500 rounded-3xl p-10 text-red-400">
          <h1 className="text-3xl font-bold mb-4">Invalid job ID</h1>
          <p className="font-mono text-sm whitespace-pre-wrap">
            Expected a numeric job id; got: {JSON.stringify(raw)}
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data: jobRaw, error } = await supabase
    .from("jobs")
    .select(
      "id, title, status, lister_id, winner_id, agreed_amount_cents, listing_id, created_at"
    )
    .eq("id", numericId)
    .maybeSingle();

  if (error) {
    console.error("❌ SUPABASE ERROR for job", numericId, ":", error.message);
    console.error("Error details:", error.details);
    console.error("Error code:", error.code);
    console.error("Error hint:", error.hint);
    return (
      <div className="max-w-4xl mx-auto p-10">
        <div className="bg-red-500/10 border border-red-500 rounded-3xl p-10 text-red-400">
          <h1 className="text-3xl font-bold mb-4">Error Loading Job</h1>
          <p className="mb-6">Job ID: {numericId}</p>
          <p className="font-mono text-sm whitespace-pre-wrap">{error.message}</p>
          {error.code ? (
            <p className="font-mono text-xs mt-4 text-red-300">
              code: {error.code}
              {error.details ? (
                <>
                  {" "}
                  · details: {error.details}
                </>
              ) : null}
              {error.hint ? (
                <>
                  {" "}
                  · hint: {error.hint}
                </>
              ) : null}
            </p>
          ) : null}
          <p className="text-xs mt-8 text-red-300">
            This is often RLS blocking SELECT on `jobs` for listings in bidding/live (or missing
            policies for your role).
          </p>
        </div>
      </div>
    );
  }

  if (!jobRaw) {
    console.error("❌ No job row returned for ID:", numericId);
    notFound();
  }

  const job = jobRaw as JobRow;

  console.log("✅ Job loaded successfully:", job.id, job.status);

  const { data: listingRaw, error: listingError } = await supabase
    .from("listings")
    .select(
      "description, suburb, postcode, bedrooms, bathrooms, buy_now_cents, reserve_cents"
    )
    .eq("id", job.listing_id)
    .maybeSingle();

  if (listingError) {
    console.error("❌ SUPABASE ERROR for listing", job.listing_id, ":", listingError.message);
    console.error("Listing error code:", listingError.code);
    return (
      <div className="max-w-4xl mx-auto p-10">
        <div className="bg-amber-500/10 border border-amber-500 rounded-3xl p-10 text-amber-200">
          <h1 className="text-3xl font-bold mb-4">Job loaded — listing blocked</h1>
          <p className="mb-4">
            Job ID: {job.id} · listing_id: {job.listing_id}
          </p>
          <p className="font-mono text-sm whitespace-pre-wrap">{listingError.message}</p>
          {listingError.code ? (
            <p className="font-mono text-xs mt-4 text-amber-100/90">
              code: {listingError.code}
              {listingError.details ? ` · details: ${listingError.details}` : ""}
            </p>
          ) : null}
          <p className="text-xs mt-6 text-amber-100/80">
            RLS on `listings` may allow `jobs` but not the related listing row for this user.
          </p>
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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-card border rounded-3xl p-10">
        <h1 className="text-4xl font-bold">{job.title ?? "Job"}</h1>
        <p className="text-muted-foreground mt-2">
          Job ID: {job.id} • Status: {job.status}
        </p>

        <div className="mt-10 grid grid-cols-2 gap-6 text-lg">
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

        <div className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">Description</h2>
          <p className="whitespace-pre-wrap">
            {listing?.description ?? "No description."}
          </p>
        </div>
      </div>
    </div>
  );
}
