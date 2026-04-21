import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PostgREST often omits PostgreSQL `42703` on the JS client — same idea as job-detail select
 * fallbacks in `load-job-for-detail-route.ts`.
 */
function isSchemaColumnMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  if (code === "42703") return true;
  const msg = String(error.message ?? "").toLowerCase();
  if (msg.includes("42703")) return true;
  if (msg.includes("undefined_column")) return true;
  if (msg.includes("does not exist")) return true;
  if (
    msg.includes("column") &&
    (msg.includes("not exist") || msg.includes("unknown") || msg.includes("could not find"))
  ) {
    return true;
  }
  if (msg.includes("schema cache") && msg.includes("column")) return true;
  return false;
}

const LISTER_DASHBOARD_JOB_SELECT_FALLBACK =
  "id, listing_id, status, created_at, updated_at, agreed_amount_cents, payment_intent_id, winner_id, cleaner_confirmed_complete, dispute_status, payment_released_at, completed_at";

const LISTER_DASHBOARD_JOB_SELECT_VARIANTS: readonly string[] = [
  "id, listing_id, status, created_at, updated_at, agreed_amount_cents, payment_intent_id, winner_id, cleaner_confirmed_complete, top_up_payments, dispute_resolution, refund_amount, proposed_refund_amount, counter_proposal_amount, dispute_status, payment_released_at, completed_at",
  "id, listing_id, status, created_at, updated_at, agreed_amount_cents, payment_intent_id, winner_id, cleaner_confirmed_complete, dispute_resolution, refund_amount, proposed_refund_amount, counter_proposal_amount, dispute_status, payment_released_at, completed_at",
  LISTER_DASHBOARD_JOB_SELECT_FALLBACK,
];

const CLEANER_DASHBOARD_JOB_SELECT_FALLBACK =
  "id, listing_id, title, status, created_at, updated_at, cleaner_confirmed_complete, agreed_amount_cents, winner_id, dispute_status, payment_released_at, completed_at";

const CLEANER_DASHBOARD_JOB_SELECT_VARIANTS: readonly string[] = [
  "id, listing_id, title, status, created_at, updated_at, cleaner_confirmed_complete, agreed_amount_cents, winner_id, top_up_payments, dispute_resolution, refund_amount, proposed_refund_amount, counter_proposal_amount, dispute_status, payment_released_at, completed_at",
  "id, listing_id, title, status, created_at, updated_at, cleaner_confirmed_complete, agreed_amount_cents, winner_id, dispute_resolution, refund_amount, proposed_refund_amount, counter_proposal_amount, dispute_status, payment_released_at, completed_at",
  CLEANER_DASHBOARD_JOB_SELECT_FALLBACK,
];

/** `/earnings` — same wide-select failure mode as dashboards (missing dispute/refund columns). */
const EARNINGS_JOB_SELECT_FALLBACK =
  "id, listing_id, title, status, created_at, updated_at, payment_released_at, agreed_amount_cents, cleaner_confirmed_complete, cleaner_confirmed_at, dispute_status, dispute_resolution, refund_amount, completed_at";

const EARNINGS_JOB_SELECT_VARIANTS: readonly string[] = [
  "id, listing_id, title, status, created_at, updated_at, payment_released_at, agreed_amount_cents, cleaner_confirmed_complete, cleaner_confirmed_at, dispute_status, dispute_resolution, refund_amount, proposed_refund_amount, counter_proposal_amount, completed_at",
  "id, listing_id, title, status, created_at, updated_at, cleaner_confirmed_complete, cleaner_confirmed_at, agreed_amount_cents, winner_id, top_up_payments, dispute_resolution, refund_amount, proposed_refund_amount, counter_proposal_amount, dispute_status, payment_released_at, completed_at",
  "id, listing_id, title, status, created_at, updated_at, cleaner_confirmed_complete, cleaner_confirmed_at, agreed_amount_cents, winner_id, dispute_resolution, refund_amount, proposed_refund_amount, counter_proposal_amount, dispute_status, payment_released_at, completed_at",
  EARNINGS_JOB_SELECT_FALLBACK,
];

/**
 * Probe which `jobs` select list works for this DB, so dashboards do not return **zero rows** when
 * one optional column is missing (job detail already falls back; dashboards used a single wide select).
 */
export async function resolveListerDashboardJobSelect(
  client: SupabaseClient,
  userId: string
): Promise<string> {
  for (const sel of LISTER_DASHBOARD_JOB_SELECT_VARIANTS) {
    const { error } = await client.from("jobs").select(sel).eq("lister_id", userId).limit(1);
    if (!error) return sel;
    if (!isSchemaColumnMissingError(error)) {
      console.warn("[lister dashboard] jobs select failed (non-schema)", {
        code: error.code,
        message: error.message,
      });
      return LISTER_DASHBOARD_JOB_SELECT_FALLBACK;
    }
  }
  return LISTER_DASHBOARD_JOB_SELECT_FALLBACK;
}

export async function resolveCleanerDashboardJobSelect(
  client: SupabaseClient,
  userId: string
): Promise<string> {
  for (const sel of CLEANER_DASHBOARD_JOB_SELECT_VARIANTS) {
    const { error } = await client.from("jobs").select(sel).eq("winner_id", userId).limit(1);
    if (!error) return sel;
    if (!isSchemaColumnMissingError(error)) {
      console.warn("[cleaner dashboard] jobs select failed (non-schema)", {
        code: error.code,
        message: error.message,
      });
      return CLEANER_DASHBOARD_JOB_SELECT_FALLBACK;
    }
  }
  return CLEANER_DASHBOARD_JOB_SELECT_FALLBACK;
}

export async function resolveCleanerEarningsJobSelect(
  client: SupabaseClient,
  userId: string
): Promise<string> {
  for (const sel of EARNINGS_JOB_SELECT_VARIANTS) {
    const { error } = await client.from("jobs").select(sel).eq("winner_id", userId).limit(1);
    if (!error) return sel;
    if (!isSchemaColumnMissingError(error)) {
      console.warn("[earnings] jobs select probe failed (non-schema)", {
        code: error.code,
        message: error.message,
      });
      return EARNINGS_JOB_SELECT_FALLBACK;
    }
  }
  return EARNINGS_JOB_SELECT_FALLBACK;
}

const MY_LISTINGS_JOB_SELECT_FALLBACK =
  "id, listing_id, winner_id, status, cleaner_confirmed_complete, cleaner_confirmed_at, updated_at, agreed_amount_cents, dispute_status, payment_released_at, completed_at";

const MY_LISTINGS_JOB_SELECT_VARIANTS: readonly string[] = [
  "id, listing_id, winner_id, status, cleaner_confirmed_complete, cleaner_confirmed_at, updated_at, disputed_at, dispute_reason, dispute_status, dispute_opened_by, agreed_amount_cents, dispute_resolution, refund_amount, proposed_refund_amount, counter_proposal_amount, payment_released_at, completed_at",
  "id, listing_id, winner_id, status, cleaner_confirmed_complete, cleaner_confirmed_at, updated_at, dispute_status, agreed_amount_cents, dispute_resolution, refund_amount, proposed_refund_amount, counter_proposal_amount, payment_released_at, completed_at",
  MY_LISTINGS_JOB_SELECT_FALLBACK,
];

/** Client refresh on My Listings — same wide-select failure mode as dashboards. */
export async function resolveListerMyListingsJobSelect(
  client: SupabaseClient,
  probeListingId: string | null
): Promise<string> {
  if (!probeListingId) return MY_LISTINGS_JOB_SELECT_FALLBACK;
  for (const sel of MY_LISTINGS_JOB_SELECT_VARIANTS) {
    const { error } = await client.from("jobs").select(sel).eq("listing_id", probeListingId).limit(1);
    if (!error) return sel;
    if (!isSchemaColumnMissingError(error)) {
      console.warn("[my-listings refresh] jobs select probe failed (non-schema)", {
        code: error.code,
        message: error.message,
      });
      return MY_LISTINGS_JOB_SELECT_FALLBACK;
    }
  }
  return MY_LISTINGS_JOB_SELECT_FALLBACK;
}
