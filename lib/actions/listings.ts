"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PHOTO_LIMITS } from "@/lib/photo-validation";
import type { Database } from "@/types/supabase";
import { createNotification } from "@/lib/actions/notifications";

type ListingUpdate = Database["public"]["Tables"]["listings"]["Update"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

export type UpdateListingDetailsResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Update safe listing details (photos + description) for the current lister.
 * Does not touch price, timing, or core scope fields.
 */
export async function updateListingDetails(
  listingId: string,
  details: { description?: string | null; photo_urls?: string[] | null }
): Promise<UpdateListingDetailsResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("id, lister_id")
    .eq("id", listingId)
    .maybeSingle();

  if (fetchError || !listing) {
    return { ok: false, error: "Listing not found." };
  }

  const row = listing as Pick<ListingRow, "id" | "lister_id">;

  if (row.lister_id !== session.user.id) {
    return { ok: false, error: "You are not allowed to edit this listing." };
  }

  const patch: ListingUpdate = {};
  if ("description" in details) {
    patch.description = details.description ?? null;
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

  const { error: updateError } = await supabase
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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("id, lister_id")
    .eq("id", listingId)
    .maybeSingle();

  if (fetchError || !listing) {
    return { ok: false, error: "Listing not found." };
  }

  const rowInitial = listing as Pick<ListingRow, "id" | "lister_id">;

  if (rowInitial.lister_id !== session.user.id) {
    return { ok: false, error: "You are not allowed to edit this listing." };
  }

  const arr = Array.isArray(photoUrls) ? photoUrls.slice(0, PHOTO_LIMITS.LISTING_INITIAL) : [];
  const { error: updateError } = await supabase
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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("id, lister_id")
    .eq("id", listingId)
    .maybeSingle();

  if (fetchError || !listing) {
    return { ok: false, error: "Listing not found." };
  }

  const rowCover = listing as Pick<ListingRow, "id" | "lister_id">;

  if (rowCover.lister_id !== session.user.id) {
    return { ok: false, error: "You are not allowed to edit this listing." };
  }

  const { error: updateError } = await supabase
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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("id, lister_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (fetchError || !listing) {
    return { ok: false, error: "Listing not found." };
  }

  const rowCancel = listing as Pick<ListingRow, "id" | "lister_id" | "status">;

  if (rowCancel.lister_id !== session.user.id) {
    return { ok: false, error: "You are not allowed to cancel this listing." };
  }

  if (rowCancel.status !== "live") {
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
  const { error: updateError } = await supabase
    .from("listings")
    .update({ status: "ended" } as ListingUpdate as never)
    .eq("id", listingId);

  if (updateError) {
    return { ok: false, error: updateError.message };
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

  revalidatePath("/my-listings");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath("/jobs");

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
