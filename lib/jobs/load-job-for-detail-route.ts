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

/** Pass `isAdmin: true` when `profiles.is_admin` for the session user (see `profileFieldIsAdmin`). */
export type JobDetailSessionOptions = {
  isAdmin?: boolean;
};

let loggedMissingServiceRoleForJobLoad = false;
let loggedMissingServiceRoleForListingLoad = false;
let loggedMissingServiceRoleForListingUuidJob = false;

const JOB_DETAIL_NO_STRIPE_REFUND = JOB_DETAIL_PAGE_SELECT.replace("refund_amount, refund_status, ", "");
const LEGACY_JOB_DETAIL_PAGE_SELECT = JOB_DETAIL_PAGE_SELECT.replace("secured_via_buy_now, ", "");
const LEGACY_JOB_DETAIL_NO_STRIPE_REFUND = LEGACY_JOB_DETAIL_PAGE_SELECT.replace(
  "refund_amount, refund_status, ",
  ""
);

/**
 * DBs may lag migrations (`secured_via_buy_now`, `refund_amount` / `refund_status`). Retry with
 * narrower selects when PostgREST reports undefined_column (42703).
 */
const JOB_DETAIL_SELECT_VARIANTS = [
  JOB_DETAIL_PAGE_SELECT,
  JOB_DETAIL_NO_STRIPE_REFUND,
  LEGACY_JOB_DETAIL_PAGE_SELECT,
  LEGACY_JOB_DETAIL_NO_STRIPE_REFUND,
] as const;

function isPostgresUndefinedColumn(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42703";
}

async function jobRowSelectWithColumnFallbacks<T>(
  run: (
    select: string
  ) => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>
): Promise<{ data: T | null; error: { code?: string; message?: string } | null }> {
  let lastError: { code?: string; message?: string } | null = null;
  for (const select of JOB_DETAIL_SELECT_VARIANTS) {
    const result = await run(select);
    if (!result.error) {
      return result;
    }
    lastError = result.error;
    if (!isPostgresUndefinedColumn(result.error)) {
      break;
    }
  }
  return { data: null, error: lastError };
}

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

function sessionMayReadJobOrAdmin(
  job: Pick<JobRow, "lister_id" | "winner_id">,
  sessionUserId: string | undefined,
  isAdmin?: boolean
): boolean {
  if (isAdmin) return true;
  return sessionMayReadJobRow(job, sessionUserId);
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
 * Load a job by numeric PK for `/jobs/[id]`. Lister, assigned cleaner, or admin (`options.isAdmin`).
 */
export async function loadJobByNumericIdForSession(
  supabase: ServerSupabaseClient,
  jobId: number,
  sessionUserId: string | undefined,
  options?: JobDetailSessionOptions
): Promise<JobRow | null> {
  const isAdmin = options?.isAdmin === true;

  const { data: fromUser, error } = await jobRowSelectWithColumnFallbacks((select) =>
    supabase.from("jobs").select(select).eq("id", jobId).maybeSingle()
  );

  if (error) {
    console.warn("[loadJobByNumericIdForSession] user-scoped jobs read error", error.code, error.message);
  }

  if (!error && fromUser) {
    const j = fromUser as JobRow;
    if (sessionMayReadJobOrAdmin(j, sessionUserId, isAdmin)) return j;
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

  const { data: full, error: adminError } = await jobRowSelectWithColumnFallbacks((select) =>
    admin.from("jobs").select(select).eq("id", jobId).maybeSingle()
  );

  if (adminError) {
    console.warn("[loadJobByNumericIdForSession] admin jobs read error", adminError.code, adminError.message);
  }

  if (!full) {
    return null;
  }

  const j = full as JobRow;
  if (sessionMayReadJobOrAdmin(j, sessionUserId, isAdmin)) {
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
  accessJob: JobRow | null,
  options?: JobDetailSessionOptions
): Promise<ListingRow | null> {
  const isAdmin = options?.isAdmin === true;

  if (isAdmin) {
    const { data: direct, error: adminUserErr } = await supabase
      .from("listings")
      .select(LISTING_FULL_SELECT)
      .eq("id", listingId)
      .maybeSingle();
    if (adminUserErr) {
      console.warn(
        "[loadListingFullForSession] admin user-scoped listings read error",
        adminUserErr.code,
        adminUserErr.message
      );
    }
    if (!adminUserErr && direct) {
      return direct as ListingRow;
    }
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data: full } = await admin
        .from("listings")
        .select(LISTING_FULL_SELECT)
        .eq("id", listingId)
        .maybeSingle();
      if (full) return full as ListingRow;
    }
    return null;
  }

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
    if (!sessionMayReadJobOrAdmin(accessJob, sessionUserId, isAdmin)) {
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
    if (j && sessionMayReadJobOrAdmin(j as JobRow, sessionUserId, isAdmin)) {
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
 * Resolve `jobs.listing_id` for a numeric job PK (service role only).
 * Used when user-scoped job reads fail but we still need the listing UUID for redirects / visibility checks.
 */
export async function tryResolveListingIdForNumericJobId(
  jobId: number
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("jobs")
    .select("listing_id")
    .eq("id", jobId)
    .maybeSingle();
  const lid = (data as { listing_id?: string | null } | null)?.listing_id;
  return lid != null && String(lid).trim() !== "" ? String(lid) : null;
}

/**
 * Latest non-cancelled job for a listing UUID route — lister, assigned cleaner, or admin.
 */
export async function loadJobForListingDetailPage(
  supabase: ServerSupabaseClient,
  listingId: string,
  sessionUserId: string | undefined,
  options?: JobDetailSessionOptions
): Promise<JobRow | null> {
  const isAdmin = options?.isAdmin === true;

  const { data: fromUser, error } = await jobRowSelectWithColumnFallbacks((select) =>
    supabase
      .from("jobs")
      .select(select)
      .eq("listing_id", listingId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  );

  if (!error && fromUser) {
    const j = fromUser as JobRow;
    if (sessionMayReadJobOrAdmin(j, sessionUserId, isAdmin)) return j;
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

  const { data: full, error: adminError } = await jobRowSelectWithColumnFallbacks((select) =>
    admin
      .from("jobs")
      .select(select)
      .eq("listing_id", listingId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  );

  if (adminError) {
    console.warn("[loadJobForListingDetailPage] admin jobs read error", adminError.code, adminError.message);
  }

  if (!full) {
    return null;
  }

  const j = full as JobRow;
  if (sessionMayReadJobOrAdmin(j, sessionUserId, isAdmin)) {
    return j;
  }

  return null;
}
