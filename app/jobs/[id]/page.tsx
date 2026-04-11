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
 * Diagnostic job detail: step-by-step server logs + UI sections.
 * `jobs` has no description/address/rooms/price — those come from `listings` via `listing_id`.
 */
export default async function JobDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const raw = resolvedParams.id.trim();

  console.log("🚀 STEP 1: Route started for job ID:", raw);

  const numericId = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(numericId)) {
    console.error("❌ STEP 1 FAILED - Not a numeric job id:", raw);
    notFound();
  }

  const supabase = await createServerSupabaseClient();

  console.log("📎 STEP 2: Fetching job row (minimal columns only)…");

  const { data: jobRaw, error } = await supabase
    .from("jobs")
    .select(
      "id, title, status, lister_id, winner_id, agreed_amount_cents, listing_id, created_at"
    )
    .eq("id", numericId)
    .maybeSingle();

  if (error || !jobRaw) {
    console.error("❌ STEP 2 FAILED - Job fetch error:", error?.message ?? error, {
      code: error?.code,
      details: error?.details,
    });
    notFound();
  }

  const job = jobRaw as JobRow;

  console.log("✅ STEP 2 SUCCESS - Basic job data loaded:", {
    id: job.id,
    title: job.title,
    listing_id: job.listing_id,
  });

  console.log("📎 STEP 3: Fetching listing for listing_id:", job.listing_id);

  const { data: listingRaw, error: listingError } = await supabase
    .from("listings")
    .select(
      "description, suburb, postcode, bedrooms, bathrooms, buy_now_cents, reserve_cents"
    )
    .eq("id", job.listing_id)
    .maybeSingle();

  if (listingError) {
    console.error("❌ STEP 3 FAILED - Listing fetch error:", listingError.message, {
      code: listingError.code,
      details: listingError.details,
    });
  } else if (!listingRaw) {
    console.warn(
      "⚠️ STEP 3 - Listing row is null (RLS or missing row for listing_id)"
    );
  } else {
    console.log("✅ STEP 3 SUCCESS - Listing row loaded");
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

  console.log("✅ STEP 4: Render — header + details + description (merged view)");

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-10">
      {/* Step 3 (UI): Header only */}
      <div className="bg-card border rounded-3xl p-10">
        <h1 className="text-4xl font-bold mb-3">{job.title ?? "Job"}</h1>
        <p className="text-xl text-muted-foreground">
          Job ID: {job.id} • Status: {job.status}
        </p>
      </div>

      {/* Step 4 (UI): Basic details — data from listing + job.agreed_amount_cents */}
      <div className="bg-card border rounded-3xl p-10">
        <h2 className="text-2xl font-semibold mb-6">Basic Details</h2>
        <div className="grid grid-cols-2 gap-y-6 text-lg">
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
      </div>

      {/* Step 5 (UI): Description — from listing */}
      <div className="bg-card border rounded-3xl p-10">
        <h2 className="text-2xl font-semibold mb-6">Description</h2>
        <p className="text-lg leading-relaxed whitespace-pre-wrap">
          {listing?.description ?? "No description provided."}
        </p>
      </div>

      <div className="text-center text-sm text-muted-foreground pt-8">
        If you see this page, the route + basic data is working.
        <br />
        Next step will be to safely add photos and role-based actions.
        <br />
        <span className="text-xs mt-2 inline-block">
          Server logs: STEP 1 → 2 (job) → 3 (listing) → 4 (render). Check Vercel/runtime
          logs, not the browser console.
        </span>
      </div>
    </div>
  );
}
