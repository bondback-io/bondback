import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type JobDiag = Pick<
  Database["public"]["Tables"]["jobs"]["Row"],
  | "id"
  | "title"
  | "status"
  | "listing_id"
  | "lister_id"
  | "winner_id"
  | "agreed_amount_cents"
  | "created_at"
>;

/**
 * Ultra-safe diagnostic: no JobDetail, no photos, no JSON-LD, no joins.
 * `jobs` has no `description`/`address`/`price`/`cleaner_id` — those live on `listings`.
 * Restore full page from git when done debugging.
 */

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Job ${id} (diagnostic) · Bond Back`,
    robots: { index: false, follow: false },
  };
}

/** Minimal column list that exists on `public.jobs` (see `types/supabase.ts`). */
const JOB_DIAGNOSTIC_SELECT =
  "id, title, status, listing_id, lister_id, winner_id, agreed_amount_cents, created_at";

export default async function JobDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams.id.trim();

  console.log("🚀 [Job Detail Diagnostic] Starting for ID:", id);

  const supabase = await createServerSupabaseClient();

  const raw = String(id).trim();
  const isNumericJobId = /^\d+$/.test(raw);

  let job: JobDiag | null = null;

  let error: { message: string; details?: string; hint?: string; code?: string } | null = null;

  if (isNumericJobId) {
    const numericPk = parseInt(raw, 10);
    const res = await supabase
      .from("jobs")
      .select(JOB_DIAGNOSTIC_SELECT)
      .eq("id", numericPk)
      .maybeSingle();
    job = res.data as JobDiag | null;
    error = res.error;
  } else {
    const res = await supabase
      .from("jobs")
      .select(JOB_DIAGNOSTIC_SELECT)
      .eq("listing_id", raw)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    job = res.data as JobDiag | null;
    error = res.error;
  }

  if (error) {
    console.error("❌ Supabase error (diagnostic):", error.message, error.details, error.code);
    notFound();
  }

  if (!job) {
    console.error("❌ No job row returned (RLS may hide it, or id invalid):", id);
    notFound();
  }

  console.log("✅ Minimal job data loaded (diagnostic):", {
    id: job.id,
    status: job.status,
    listing_id: job.listing_id,
  });

  const priceAud =
    job.agreed_amount_cents != null && job.agreed_amount_cents > 0
      ? (job.agreed_amount_cents / 100).toFixed(2)
      : "—";

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl rounded-2xl border bg-card p-10">
        <h1 className="mb-6 text-5xl font-bold">Job detail (diagnostic)</h1>
        <div className="space-y-4 text-lg">
          <p>
            <strong>Route id:</strong> {id}
          </p>
          <p>
            <strong>Job PK:</strong> {job.id}
          </p>
          <p>
            <strong>Title:</strong> {job.title ?? "—"}
          </p>
          <p>
            <strong>Status:</strong> {job.status}
          </p>
          <p>
            <strong>Listing ID:</strong> {job.listing_id}
          </p>
          <p>
            <strong>Lister ID:</strong> {job.lister_id}
          </p>
          <p>
            <strong>Winner ID:</strong> {job.winner_id ?? "—"}
          </p>
          <p>
            <strong>Agreed (AUD):</strong> ${priceAud}
          </p>
          <p>
            <strong>Created:</strong> {job.created_at}
          </p>
        </div>

        <div className="mt-12 rounded-xl bg-muted p-6">
          <p className="text-sm text-muted-foreground">
            If you see this, the route and a minimal <code className="rounded bg-background px-1">jobs</code> select
            work. Photos / full UI are not loaded here.
            <br />
            Restore the full <code className="rounded bg-background px-1">page.tsx</code> from git when finished.
          </p>
        </div>
      </div>
    </div>
  );
}
