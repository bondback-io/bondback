import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { JOB_DETAIL_PAGE_SELECT, LISTING_FULL_SELECT } from "@/lib/supabase/queries";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

/** Matches `createServerSupabaseClient()` return type (avoids SupabaseClient generic mismatch). */
export type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function sameUserId(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/**
 * Load a job by numeric PK for `/jobs/[id]`. Uses the user-scoped client first; if no row is
 * returned (common when RLS allows cleaners but not listers to read `jobs`), falls back to the
 * service role and returns the row only when `sessionUserId` is `lister_id` or `winner_id`.
 */
export async function loadJobByNumericIdForSession(
  supabase: ServerSupabaseClient,
  jobId: number,
  sessionUserId: string | undefined
): Promise<JobRow | null> {
  const { data: fromUser, error } = await supabase
    .from("jobs")
    .select(JOB_DETAIL_PAGE_SELECT)
    .eq("id", jobId)
    .maybeSingle();

  if (!error && fromUser) {
    return fromUser as JobRow;
  }

  const admin = createSupabaseAdminClient();
  if (!admin || !sessionUserId?.trim()) {
    return null;
  }

  const { data: full } = await admin
    .from("jobs")
    .select(JOB_DETAIL_PAGE_SELECT)
    .eq("id", jobId)
    .maybeSingle();

  if (!full) {
    return null;
  }

  const j = full as JobRow;
  if (sameUserId(j.lister_id, sessionUserId) || sameUserId(j.winner_id, sessionUserId)) {
    return j;
  }

  return null;
}

/**
 * Load listing row for `/jobs/[id]`. Many DB setups let winners read `jobs` but not `listings`;
 * listers can be the opposite. When `accessJob` proves the user is lister or winner, fall back to
 * the service role to load the listing (same security model as {@link loadJobByNumericIdForSession}).
 */
export async function loadListingFullForSession(
  supabase: ServerSupabaseClient,
  listingId: string,
  sessionUserId: string | undefined,
  accessJob: JobRow | null
): Promise<ListingRow | null> {
  const { data: fromUser, error } = await supabase
    .from("listings")
    .select(LISTING_FULL_SELECT)
    .eq("id", listingId)
    .maybeSingle();

  if (!error && fromUser) {
    return fromUser as ListingRow;
  }

  const admin = createSupabaseAdminClient();
  if (!admin || !sessionUserId?.trim() || !accessJob) {
    return null;
  }

  const j = accessJob;
  if (!sameUserId(j.lister_id, sessionUserId) && !sameUserId(j.winner_id, sessionUserId)) {
    return null;
  }

  const { data: full } = await admin
    .from("listings")
    .select(LISTING_FULL_SELECT)
    .eq("id", listingId)
    .maybeSingle();

  return (full as ListingRow) ?? null;
}

/**
 * Latest non-cancelled job for a listing UUID route, with the same RLS + service-role fallback as
 * the numeric job loader (party must be lister or winner when using admin).
 */
export async function loadJobForListingDetailPage(
  supabase: ServerSupabaseClient,
  listingId: string,
  sessionUserId: string | undefined
): Promise<JobRow | null> {
  const { data: fromUser, error } = await supabase
    .from("jobs")
    .select(JOB_DETAIL_PAGE_SELECT)
    .eq("listing_id", listingId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && fromUser) {
    return fromUser as JobRow;
  }

  const admin = createSupabaseAdminClient();
  if (!admin || !sessionUserId?.trim()) {
    return null;
  }

  const { data: full } = await admin
    .from("jobs")
    .select(JOB_DETAIL_PAGE_SELECT)
    .eq("listing_id", listingId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!full) {
    return null;
  }

  const j = full as JobRow;
  if (sameUserId(j.lister_id, sessionUserId) || sameUserId(j.winner_id, sessionUserId)) {
    return j;
  }

  return null;
}
