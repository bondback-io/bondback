/**
 * Server-only: whether My Listings overview should show “Cancel job (escrow)…” — must match
 * `getListerNonResponsiveCancelPreview` + `shouldShowListerNonResponsiveCancelControl` on the job page.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getListerNonResponsiveCancelPreview } from "@/lib/jobs/lister-nonresponsive-cancel-server";

export type MyListingsJobForEscrowPreview = {
  id: number | string;
  lister_id?: string | null;
  winner_id?: string | null;
  status?: string | null;
  listing_id?: string | null;
  agreed_amount_cents?: number | null;
  payment_intent_id?: string | null;
  payment_released_at?: string | null;
  escrow_funded_at?: string | null;
  created_at?: string | null;
  lister_escrow_cancelled_at?: string | null;
  disputed_at?: string | null;
  dispute_status?: string | null;
};

export async function escrowCancelMenuEligibleByJobId(
  client: SupabaseClient<Database, "public", any>,
  rows: MyListingsJobForEscrowPreview[]
): Promise<Map<number, boolean>> {
  const unique = new Map<number, MyListingsJobForEscrowPreview>();
  for (const r of rows) {
    const id = Number(r.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!unique.has(id)) unique.set(id, r);
  }
  const results = await Promise.all(
    [...unique.entries()].map(async ([id, job]) => {
      const preview = await getListerNonResponsiveCancelPreview(client, {
        id,
        lister_id: String(job.lister_id ?? ""),
        winner_id: job.winner_id ?? null,
        status: job.status ?? null,
        listing_id: job.listing_id != null ? String(job.listing_id) : null,
        agreed_amount_cents: job.agreed_amount_cents ?? null,
        payment_intent_id: job.payment_intent_id ?? null,
        payment_released_at: job.payment_released_at ?? null,
        escrow_funded_at: job.escrow_funded_at ?? null,
        created_at: job.created_at ?? null,
        lister_escrow_cancelled_at: job.lister_escrow_cancelled_at ?? null,
        disputed_at: job.disputed_at ?? null,
        dispute_status: job.dispute_status ?? null,
      });
      return [id, preview.eligible] as const;
    })
  );
  return new Map(results);
}
