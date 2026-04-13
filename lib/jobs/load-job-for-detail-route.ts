import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { parseUtcTimestamp } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { JOB_DETAIL_PAGE_SELECT, LISTING_FULL_SELECT } from "@/lib/supabase/queries";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

/** Matches `createServerSupabaseClient()` return type (avoids SupabaseClient generic mismatch). */
export type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

let loggedMissingServiceRoleForJobLoad = false;
let loggedMissingServiceRoleForListingLoad = false;
let loggedMissingServiceRoleForListingUuidJob = false;

function sameUserId(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/**
 * Job detail (`/jobs/[numericId]`) and job-in-listing context: only the lister who owns the listing
 * and the assigned cleaner (`winner_id`) may read the job row.
 */
export function sessionMayReadJobRow(
  job: Pick<JobRow, "lister_id" | "winner_id">,
  sessionUserId: string | undefined
): boolean {
  const uid = sessionUserId?.trim();
  if (!uid) return false;
  if (sameUserId(job.lister_id, uid)) return true;
  if (job.winner_id != null && String(job.winner_id).trim() !== "" && sameUserId(job.winner_id, uid)) {
    return true;
  }
  return false;
}

/** True when a non-cancelled job exists with an assigned cleaner for this listing. */
export async function listingHasAssignedWinnerJob(
  admin: AdminClient,
  listingId: string
): Promise<boolean> {
  const { data } = await admin
    .from("jobs")
    .select("id")
    .eq("listing_id", listingId)
    .neq("status", "cancelled")
    .not("winner_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data != null;
}

/**
 * Listing detail visible to the public (non-parties) on `/listings/[uuid]`: open auctions, ended
 * auctions without an assigned job, and expired (no-bid) relist pool. Never when a cleaner is
 * already assigned (those rows are lister + winner only).
 */
export function listingIsPublicMarketplaceListing(
  row: ListingRow,
  hasAssignedWinnerJob: boolean
): boolean {
  if (row.cancelled_early_at != null) return false;
  if (hasAssignedWinnerJob) return false;
  const st = String(row.status ?? "").toLowerCase();
  if (st === "expired") return true;
  if (st === "live" || st === "ended") return true;
  return false;
}

/**
 * Matches Find Jobs / `isListingLive` timing — must use `parseUtcTimestamp` so timezoneless
 * ISO strings match DB/PostgREST (plain `new Date()` treats them as local and can wrongly hide
 * live listings, causing 404 on `/jobs/[id]` for new/live rows).
 *
 * **Note:** This does **not** encode assigned-job privacy; use {@link listingIsPublicMarketplaceListing}
 * for who may see another user’s listing detail. Kept for debug/SEO timing parity.
 */
export function isMarketplaceVisibleListing(row: ListingRow): boolean {
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
  if (endMs <= Date.now()) {
    return true;
  }
  return endMs > Date.now();
}

/**
 * Load a job by numeric PK for `/jobs/[id]`. Only the lister or assigned cleaner may read the row
 * (no anonymous access, no losing bidders, no “marketplace mirror”).
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

  if (error) {
    console.warn("[loadJobByNumericIdForSession] user-scoped jobs read error", error.code, error.message);
  }

  if (!error && fromUser) {
    const j = fromUser as JobRow;
    if (sessionMayReadJobRow(j, sessionUserId)) return j;
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
  if (sessionMayReadJobRow(j, sessionUserId)) {
    return j;
  }

  return null;
}

/**
 * Load listing row for `/jobs/[id]` or `/listings/[id]`.
 * - Lister (owner) always.
 * - With an assigned job: only lister + winner; other cleaners and other listers get 404.
 * - Without an assigned job: bidders may read; public read matches {@link listingIsPublicMarketplaceListing}.
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

  if (error) {
    console.warn("[loadListingFullForSession] user-scoped listings read error", error.code, error.message);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!loggedMissingServiceRoleForListingLoad) {
      loggedMissingServiceRoleForListingLoad = true;
      console.warn(
        "[loadListingFullForSession] SUPABASE_SERVICE_ROLE_KEY missing — listing detail cannot bypass RLS. Set it in Vercel/server env."
      );
    }
    if (!error && fromUser) {
      return fromUser as ListingRow;
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
    if (!sessionMayReadJobRow(accessJob, sessionUserId)) {
      return null;
    }
    return row;
  }

  const hasAssigned = await listingHasAssignedWinnerJob(admin, listingId);

  if (hasAssigned) {
    if (!sessionUserId?.trim()) {
      return null;
    }
    if (sameUserId(row.lister_id, sessionUserId)) {
      return row;
    }
    const { data: j } = await admin
      .from("jobs")
      .select("lister_id, winner_id, status, listing_id")
      .eq("listing_id", listingId)
      .neq("status", "cancelled")
      .not("winner_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (j && sessionMayReadJobRow(j as JobRow, sessionUserId)) {
      return row;
    }
    return null;
  }

  if (sessionUserId?.trim() && sameUserId(row.lister_id, sessionUserId)) {
    return row;
  }

  if (sessionUserId?.trim()) {
    const { data: bidExists } = await admin
      .from("bids")
      .select("id")
      .eq("listing_id", listingId)
      .eq("cleaner_id", sessionUserId)
      .limit(1)
      .maybeSingle();
    if (bidExists) {
      return row;
    }
  }

  if (listingIsPublicMarketplaceListing(row, false)) {
    return row;
  }

  return null;
}

/**
 * Latest non-cancelled job for a listing UUID route — only returned to lister or assigned cleaner.
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
    const j = fromUser as JobRow;
    if (sessionMayReadJobRow(j, sessionUserId)) return j;
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
  if (sessionMayReadJobRow(j, sessionUserId)) {
    return j;
  }

  return null;
}
