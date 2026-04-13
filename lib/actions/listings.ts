"use server";

import { revalidatePath } from "next/cache";
import { revalidateJobsBrowseCaches } from "@/lib/cache-revalidate";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PHOTO_LIMITS } from "@/lib/photo-validation";
import type { Database } from "@/types/supabase";
import { createNotification, notifyListerListingLive } from "@/lib/actions/notifications";
import {
  relistDurationMsFromDurationDays,
  clampAuctionDurationDays,
  type ListingInsertPayload,
} from "@/lib/listings";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { isListerRelistPoolListingStatus } from "@/lib/my-listings/lister-listing-helpers";

type ListingUpdate = Database["public"]["Tables"]["listings"]["Update"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

/** Same shape as `createServerSupabaseClient` / admin client for `.from("listings")` updates. */
type ListingsDbClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * Resolve a listing the current user owns and return a client that can read/update it.
 * When `SUPABASE_SERVICE_ROLE_KEY` is set, uses the admin client so SELECT/UPDATE succeed even if
 * RLS does not yet expose the new row to the user-scoped client (same model as createListingForPublish).
 */
async function getListerListingWriteClient(
  listingId: string,
  userId: string
): Promise<{ ok: true; client: ListingsDbClient } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const admin = createSupabaseAdminClient();

  if (admin) {
    const { data, error } = await admin
      .from("listings")
      .select("id, lister_id")
      .eq("id", listingId)
      .maybeSingle();
    if (error || !data) {
      return { ok: false, error: "Listing not found." };
    }
    const row = data as Pick<ListingRow, "id" | "lister_id">;
    if (row.lister_id !== userId) {
      return { ok: false, error: "You are not allowed to edit this listing." };
    }
    return { ok: true, client: admin as unknown as ListingsDbClient };
  }

  const { data, error } = await supabase
    .from("listings")
    .select("id, lister_id")
    .eq("id", listingId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Listing not found." };
  }
  const row = data as Pick<ListingRow, "id" | "lister_id">;
  if (row.lister_id !== userId) {
    return { ok: false, error: "You are not allowed to edit this listing." };
  }
  return { ok: true, client: supabase };
}

export type CreateListingForPublishResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Inserts a listing on the server so publish works even when browser `anon` + RLS has no INSERT
 * policy, or when PostgREST rejects client payloads. Validates `lister_id` == session user.
 * Uses `SUPABASE_SERVICE_ROLE_KEY` when set (bypasses RLS); otherwise the user-scoped client.
 */
export async function createListingForPublish(
  row: ListingInsertPayload
): Promise<CreateListingForPublishResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "You must be logged in." };
  }

  /** Never trust client-supplied lister_id — avoids mismatch when session cookie is the source of truth. */
  const rowToInsert: ListingInsertPayload = {
    ...row,
    lister_id: user.id,
  };

  const admin = createSupabaseAdminClient();

  const insertQuery = admin
    ? await admin.from("listings").insert(rowToInsert as never).select("id").maybeSingle()
    : await supabase.from("listings").insert(rowToInsert as never).select("id").maybeSingle();

  const { data, error } = insertQuery;

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data?.id) {
    return {
      ok: false,
      error:
        "Insert did not return a listing id. Often this means RLS blocks SELECT on the new row after INSERT — run supabase/sql/20260413120000_listings_rls_lister_insert_update.sql (includes listings_select_own_lister) or set SUPABASE_SERVICE_ROLE_KEY on the server.",
    };
  }

  revalidatePath("/my-listings");
  revalidatePath("/jobs");
  return { ok: true, id: String(data.id) };
}

export type FetchListingsForListerOptions = {
  /** PostgREST select list; default `"*"`. */
  select?: string;
  /** Default: `id` descending (newest numeric id first). */
  orderBy?: { column: "id" | "created_at"; ascending?: boolean };
};

/**
 * Load all listings for a lister. When `SUPABASE_SERVICE_ROLE_KEY` is set, uses the admin client
 * so rows appear even if RLS has no SELECT policy for `listings` (insert/publish often uses admin).
 * Caller must only pass the authenticated user's id.
 */
export async function fetchListingsForLister(
  userId: string,
  options?: FetchListingsForListerOptions
): Promise<ListingRow[]> {
  const select = options?.select ?? "*";
  const orderColumn = options?.orderBy?.column ?? "id";
  const ascending = options?.orderBy?.ascending ?? false;

  const supabase = await createServerSupabaseClient();
  const admin = createSupabaseAdminClient();
  const run = admin
    ? await admin
        .from("listings")
        .select(select)
        .eq("lister_id", userId)
        .order(orderColumn, { ascending })
    : await supabase
        .from("listings")
        .select(select)
        .eq("lister_id", userId)
        .order(orderColumn, { ascending });
  const { data, error } = run;
  if (error) {
    console.warn("[fetchListingsForLister]", error.message);
    return [];
  }
  return (data ?? []) as unknown as ListingRow[];
}

export type UpdateListingDetailsResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Update safe listing details (photos + property narrative) for the current lister.
 * Does not touch price, timing, or core scope fields.
 */
export async function updateListingDetails(
  listingId: string,
  details: {
    description?: string | null;
    property_description?: string | null;
    photo_urls?: string[] | null;
  }
): Promise<UpdateListingDetailsResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "You must be logged in." };
  }

  const access = await getListerListingWriteClient(listingId, user.id);
  if (!access.ok) {
    return access;
  }

  const patch: ListingUpdate = {};
  if ("description" in details) {
    patch.description = details.description ?? null;
  }
  if ("property_description" in details) {
    patch.property_description = details.property_description ?? null;
  }
  if ("photo_urls" in details) {
    const urls = details.photo_urls ?? null;
    const arr = Array.isArray(urls) ? urls : [];
    if (arr.length > PHOTO_LIMITS.LISTING_EDIT) {
      return {
        ok: false,
        error: `Too many photos (max ${PHOTO_LIMITS.LISTING_EDIT} allowed).`,
      };
    }
    patch.photo_urls = arr.length > 0 ? arr : null;
  }

  const { error: updateError } = await access.client
    .from("listings")
    .update(patch as never)
    .eq("id", listingId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/my-listings");
  revalidatePath(`/jobs/${listingId}`);

  return { ok: true };
}

export type UpdateListingInitialPhotosResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Set initial_photos (condition-before URLs) for a listing. Used after upload on new listing create.
 * Same auth as updateListingDetails: must be the lister.
 */
export async function updateListingInitialPhotos(
  listingId: string,
  photoUrls: string[]
): Promise<UpdateListingInitialPhotosResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "You must be logged in." };
  }

  const access = await getListerListingWriteClient(listingId, user.id);
  if (!access.ok) {
    return access;
  }

  const arr = Array.isArray(photoUrls) ? photoUrls.slice(0, PHOTO_LIMITS.LISTING_INITIAL) : [];
  const { error: updateError } = await access.client
    .from("listings")
    .update({ initial_photos: arr.length > 0 ? arr : null } as ListingUpdate as never)
    .eq("id", listingId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/my-listings");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath("/listings/new");

  return { ok: true };
}

export type UpdateListingCoverPhotoResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Set the default/cover photo URL for a listing (for cards). Lister only.
 */
export async function updateListingCoverPhoto(
  listingId: string,
  coverPhotoUrl: string | null
): Promise<UpdateListingCoverPhotoResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "You must be logged in." };
  }

  const access = await getListerListingWriteClient(listingId, user.id);
  if (!access.ok) {
    return access;
  }

  const { error: updateError } = await access.client
    .from("listings")
    .update({ cover_photo_url: coverPhotoUrl } as ListingUpdate as never)
    .eq("id", listingId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/my-listings");
  revalidatePath(`/jobs/${listingId}`);

  return { ok: true };
}

export type CancelListingResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Cancel a listing for the current lister by setting status = 'cancelled'.
 * The listing remains in history but is no longer live.
 */
export async function cancelListing(listingId: string): Promise<CancelListingResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("roles, active_role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileRow as {
    roles: string[] | null;
    active_role: string | null;
  } | null;
  const roles = (profile?.roles ?? []) as string[];
  const activeRole =
    (profile?.active_role as string | null) ?? (roles[0] ?? null);

  if (!roles.includes("lister") || activeRole !== "lister") {
    return {
      ok: false,
      error:
        "Switch to lister mode in the header or Settings to cancel a listing.",
    };
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("id, lister_id, status, title")
    .eq("id", listingId)
    .maybeSingle();

  if (fetchError || !listing) {
    return { ok: false, error: "Listing not found." };
  }

  const rowCancel = listing as Pick<ListingRow, "id" | "lister_id" | "status">;

  if (rowCancel.lister_id !== user.id) {
    return { ok: false, error: "You are not allowed to cancel this listing." };
  }

  const statusNorm = String(rowCancel.status ?? "")
    .trim()
    .toLowerCase();
  if (statusNorm !== "live") {
    return { ok: false, error: "Only live listings can be cancelled." };
  }

  // Some databases enforce a CHECK constraint on status (e.g. 'live' or 'ended').
  // Use 'ended' to represent a cancelled/closed auction so we don't violate it.
  // Also cancel any active job linked to this listing so it is no longer actionable.
  const { data: linkedJobsRaw } = await supabase
    .from("jobs")
    .select("id, winner_id, status")
    .eq("listing_id", listingId)
    .in("status", ["accepted", "in_progress"]);

  const linkedJobs = (linkedJobsRaw ?? []) as Pick<
    JobRow,
    "id" | "winner_id" | "status"
  >[];

  const nowIso = new Date().toISOString();
  /** Require lister match on update so RLS / stale rows return a clear failure instead of silent no-op. */
  const { data: updatedRow, error: updateError } = await supabase
    .from("listings")
    .update({ status: "ended", cancelled_early_at: nowIso } as ListingUpdate as never)
    .eq("id", listingId)
    .eq("lister_id", user.id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: updateError.message };
  }
  if (!updatedRow) {
    return {
      ok: false,
      error:
        "Could not cancel this listing. It may no longer be live, or you may not have permission to update it.",
    };
  }

  if ((linkedJobs ?? []).length > 0) {
    const ids = linkedJobs!.map((j) => j.id);
    const { error: jobsUpdateError } = await supabase
      .from("jobs")
      .update({ status: "cancelled", updated_at: nowIso } as never)
      .in("id", ids as any);
    if (jobsUpdateError) {
      return { ok: false, error: jobsUpdateError.message };
    }

    for (const j of linkedJobs ?? []) {
      if (j.winner_id) {
        await createNotification(
          j.winner_id,
          "job_cancelled_by_lister",
          Number(j.id),
          "This job listing has been cancelled by the property lister. You have been un-assigned from the job."
        );
      }
    }
  }

  /** Cleaners with an active or pending-confirmation bid — auction ended early (no job / not winner). */
  const listingTitle =
    (listing as { title?: string | null }).title?.trim() ?? null;
  const { data: activeBidRows } = await supabase
    .from("bids")
    .select("cleaner_id")
    .eq("listing_id", listingId)
    .in("status", ["active", "pending_confirmation"]);
  const bidderIds = new Set<string>();
  for (const row of activeBidRows ?? []) {
    const cid = (row as { cleaner_id: string }).cleaner_id;
    if (cid && cid !== user.id) bidderIds.add(cid);
  }
  for (const cleanerId of bidderIds) {
    const msg = listingTitle
      ? `The property lister ended this auction early. Your bid on "${listingTitle}" is no longer active.`
      : "The property lister ended this auction early. Your bid is no longer active.";
    await createNotification(cleanerId, "listing_cancelled_by_lister", null, msg, {
      listingUuid: listingId,
      listingTitle,
    });
  }

  revalidateJobsBrowseCaches();
  revalidatePath("/my-listings");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath("/jobs");
  revalidatePath("/lister/dashboard");
  revalidatePath("/cleaner/dashboard");

  return { ok: true };
}

/**
 * Closes auctions whose `end_time` has passed: assigns lowest active bid (creates job) or sets
 * `expired` / `ended`. Uses service role when available; otherwise falls back to DB RPC (no winner).
 */
export async function applyListingAuctionOutcomes(): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { resolveExpiredLiveAuctions } = await import("@/lib/actions/auction-resolution");
    const r = await resolveExpiredLiveAuctions();
    if (r.errors.length) {
      console.warn("[applyListingAuctionOutcomes]", r.errors);
    }
    return;
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("apply_listing_auction_outcomes");
  if (error) {
    console.warn("[applyListingAuctionOutcomes]", error.message);
  }
}

export type RelistExpiredListingResult =
  | { ok: true }
  | { ok: false; error: string };

/** Optional overrides when relisting an expired (no-bid) auction. */
export type RelistExpiredListingOptions = {
  moveOutDate?: string | null;
  startingPriceCents?: number;
  durationDays?: number;
};

/**
 * Relist an expired auction: same details by default, fresh timer, bids cleared.
 * Optionally override move-out date, starting price, and listing duration.
 */
export async function relistExpiredListing(
  listingId: string,
  options?: RelistExpiredListingOptions
): Promise<RelistExpiredListingResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();

  if (fetchError || !listing) {
    return { ok: false, error: "Listing not found." };
  }

  const row = listing as ListingRow;
  if (row.lister_id !== session.user.id) {
    return { ok: false, error: "You are not allowed to relist this listing." };
  }
  const listingStatus = String(row.status ?? "").toLowerCase();
  const nowMs = Date.now();
  if (!isListerRelistPoolListingStatus(row, nowMs)) {
    return {
      ok: false,
      error: "Only expired or closed (ended) auctions without an active job can be relisted.",
    };
  }

  const { data: blockingJobs, error: blockErr } = await supabase
    .from("jobs")
    .select("id")
    .eq("listing_id", listingId)
    .neq("status", "cancelled")
    .limit(1);
  if (blockErr) {
    return { ok: false, error: blockErr.message };
  }
  if (blockingJobs && blockingJobs.length > 0) {
    return {
      ok: false,
      error: "Cannot relist while this listing has an active job.",
    };
  }

  const settings = await getGlobalSettings();
  const allowTwoMin =
    (settings as { allow_two_minute_auction_test?: boolean } | null)?.allow_two_minute_auction_test === true;
  const rawDuration =
    options?.durationDays != null && Number.isFinite(Number(options.durationDays))
      ? Number(options.durationDays)
      : Number(row.duration_days);
  const durationDays = clampAuctionDurationDays(rawDuration, allowTwoMin);
  const endTime = new Date(Date.now() + relistDurationMsFromDurationDays(durationDays)).toISOString();
  const starting =
    options?.startingPriceCents != null && Number.isFinite(Number(options.startingPriceCents))
      ? Math.max(0, Math.round(Number(options.startingPriceCents)))
      : ((row.starting_price_cents as number) ?? 0);

  const admin = createSupabaseAdminClient();
  if (admin) {
    const { error: delErr } = await admin
      .from("bids")
      .delete()
      .eq("listing_id", listingId);
    if (delErr) {
      return { ok: false, error: delErr.message };
    }
  } else {
    const { error: bidDelErr } = await supabase
      .from("bids")
      .delete()
      .eq("listing_id", listingId);
    if (bidDelErr) {
      return { ok: false, error: bidDelErr.message };
    }
  }

  const patch: ListingUpdate = {
    status: "live",
    end_time: endTime,
    current_lowest_bid_cents: starting,
    cancelled_early_at: null,
    starting_price_cents: starting,
    duration_days: Number.isFinite(durationDays) && durationDays >= 0 ? durationDays : row.duration_days,
  };

  if (options?.moveOutDate !== undefined) {
    patch.move_out_date = options.moveOutDate;
  }

  let statusLocked = supabase
    .from("listings")
    .update(patch as never)
    .eq("id", listingId)
    .eq("lister_id", session.user.id);
  if (listingStatus === "live") {
    const cutoffIso = new Date(nowMs).toISOString();
    statusLocked = statusLocked.eq("status", "live").lte("end_time", cutoffIso);
  } else {
    statusLocked = statusLocked.in("status", ["expired", "ended"]);
  }
  const { data: updatedRow, error: updErr } = await statusLocked.select("id").maybeSingle();

  if (updErr) {
    return { ok: false, error: updErr.message };
  }
  if (!updatedRow) {
    return {
      ok: false,
      error: "Could not relist. The listing may no longer be in the relist pool.",
    };
  }

  revalidateJobsBrowseCaches();
  revalidatePath("/my-listings");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/lister/dashboard");
  revalidatePath("/cleaner/dashboard");

  void triggerNewListingJobAlerts(listingId);
  void notifyListerListingLive(listingId).catch(() => {});

  return { ok: true };
}

/**
 * Fire SMS + push new-job alerts to nearby cleaners (called automatically after publish in new-listing-form).
 * Safe to call again only for testing; respects global kill switch and per-cleaner prefs.
 */
export async function triggerNewListingJobAlerts(listingId: string) {
  const { notifyNearbyCleanersOfNewListing } = await import("@/lib/actions/sms-notifications");
  return notifyNearbyCleanersOfNewListing(listingId);
}
