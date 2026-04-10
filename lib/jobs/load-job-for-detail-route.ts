import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { parseUtcTimestamp } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { JOB_DETAIL_PAGE_SELECT, LISTING_FULL_SELECT } from "@/lib/supabase/queries";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

/** Matches `createServerSupabaseClient()` return type (avoids SupabaseClient generic mismatch). */
export type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

let loggedMissingServiceRoleForJobLoad = false;
let loggedMissingServiceRoleForListingLoad = false;
let loggedMissingServiceRoleForListingUuidJob = false;

function sameUserId(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/**
 * Matches Find Jobs / `isListingLive` timing — must use `parseUtcTimestamp` so timezoneless
 * ISO strings match DB/PostgREST (plain `new Date()` treats them as local and can wrongly hide
 * live listings, causing 404 on `/jobs/[id]` for new/live rows).
 */
function isMarketplaceVisibleListing(row: ListingRow): boolean {
  const st = String(row.status ?? "").toLowerCase();
  if (st === "ended" || st === "expired") {
    return true;
  }
  if (st !== "live") {
    return false;
  }
  if (row.cancelled_early_at != null) {
    return false;
  }
  const endRaw = row.end_time;
  if (endRaw == null || String(endRaw).trim() === "") {
    return true;
  }
  const endMs = parseUtcTimestamp(String(endRaw));
  if (Number.isNaN(endMs)) {
    return true;
  }
  return endMs > Date.now();
}

/**
 * Load a job by numeric PK for `/jobs/[id]`. Uses the user-scoped client first; if no row is
 * returned (common when RLS allows cleaners but not listers to read `jobs`), falls back to the
 * service role and returns the row when `sessionUserId` is `lister_id` or `winner_id`.
 * Without a session, returns the job only when the linked listing is marketplace-visible (public).
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
  if (!admin) {
    if (!loggedMissingServiceRoleForJobLoad) {
      loggedMissingServiceRoleForJobLoad = true;
      console.warn(
        "[loadJobByNumericIdForSession] SUPABASE_SERVICE_ROLE_KEY missing — job detail cannot bypass RLS. Set it in Vercel/server env."
      );
    }
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

  if (sessionUserId?.trim()) {
    if (sameUserId(j.lister_id, sessionUserId) || sameUserId(j.winner_id, sessionUserId)) {
      return j;
    }
    return null;
  }

  const { data: listRow } = await admin
    .from("listings")
    .select(LISTING_FULL_SELECT)
    .eq("id", j.listing_id)
    .maybeSingle();

  if (!listRow) {
    return null;
  }

  const lr = listRow as ListingRow;
  if (isMarketplaceVisibleListing(lr)) {
    return j;
  }

  return null;
}

/**
 * Load listing row for `/jobs/[id]`.
 * - User-scoped client first (RLS).
 * - Service role when the user is lister/winner on `accessJob` (RLS mismatch between jobs vs listings).
 * - When there is no job context (Find Jobs / browse), service role only for marketplace-visible rows
 *   or rows owned by the current user (new lister viewing their listing before RLS exposes it).
 * - Without `sessionUserId`, only marketplace-visible rows are returned via admin (e.g. OG metadata).
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
  if (!admin) {
    if (!loggedMissingServiceRoleForListingLoad) {
      loggedMissingServiceRoleForListingLoad = true;
      console.warn(
        "[loadListingFullForSession] SUPABASE_SERVICE_ROLE_KEY missing — listing detail cannot bypass RLS. Set it in Vercel/server env."
      );
    }
    return null;
  }

  const { data: full } = await admin
    .from("listings")
    .select(LISTING_FULL_SELECT)
    .eq("id", listingId)
    .maybeSingle();

  if (!full) {
    return null;
  }

  const row = full as ListingRow;

  if (accessJob) {
    if (String(accessJob.listing_id) !== String(listingId)) {
      return null;
    }
    const isParty =
      !!sessionUserId?.trim() &&
      (sameUserId(accessJob.lister_id, sessionUserId) ||
        sameUserId(accessJob.winner_id, sessionUserId));
    if (isParty) {
      return row;
    }
    if (!sessionUserId?.trim() && isMarketplaceVisibleListing(row)) {
      return row;
    }
    return null;
  }

  if (sessionUserId?.trim() && sameUserId(row.lister_id, sessionUserId)) {
    return row;
  }

  if (isMarketplaceVisibleListing(row)) {
    return row;
  }

  return null;
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
  if (!admin) {
    if (!loggedMissingServiceRoleForListingUuidJob) {
      loggedMissingServiceRoleForListingUuidJob = true;
      console.warn(
        "[loadJobForListingDetailPage] SUPABASE_SERVICE_ROLE_KEY missing — cannot load job for listing UUID."
      );
    }
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

  if (sessionUserId?.trim()) {
    if (sameUserId(j.lister_id, sessionUserId) || sameUserId(j.winner_id, sessionUserId)) {
      return j;
    }
    return null;
  }

  const { data: listRow } = await admin
    .from("listings")
    .select(LISTING_FULL_SELECT)
    .eq("id", listingId)
    .maybeSingle();

  if (!listRow) {
    return null;
  }

  if (isMarketplaceVisibleListing(listRow as ListingRow)) {
    return j;
  }

  return null;
}
