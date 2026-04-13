"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import type { BidBidderProfileSummary } from "@/lib/bids/bidder-types";
import { BIDDER_PROFILE_SUMMARY_SELECT } from "@/lib/bids/enrich-bids-with-bidders";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export type UpdateCleanerUsernameResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Set or clear the cleaner’s public marketplace username (unique, case-insensitive).
 */
export async function updateCleanerUsername(
  raw: string | null | undefined
): Promise<UpdateCleanerUsernameResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const userId = session.user.id;

  const { data: prof } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", userId)
    .maybeSingle();
  const roles = ((prof as { roles?: string[] | null } | null)?.roles ?? []) as string[];
  if (!roles.includes("cleaner")) {
    return { ok: false, error: "Only cleaners can set a marketplace username." };
  }

  const trimmed = (raw ?? "").trim();
  const normalized = trimmed === "" ? null : trimmed.toLowerCase();

  if (normalized != null) {
    if (!USERNAME_RE.test(normalized)) {
      return {
        ok: false,
        error:
          "Username must be 3–24 characters: letters, numbers, and underscores only (stored in lowercase).",
      };
    }
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error (admin client unavailable)." };
  }

  if (normalized != null) {
    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .eq("cleaner_username", normalized)
      .neq("id", userId)
      .maybeSingle();
    if (taken) {
      return {
        ok: false,
        error: "That username is already taken. Try a different one.",
      };
    }
  }

  const patch: ProfileUpdate = {
    cleaner_username: normalized,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("profiles")
    .update(patch as never)
    .eq("id", userId);

  if (error) {
    if (error.code === "23505" || /unique|duplicate/i.test(error.message)) {
      return { ok: false, error: "That username is already taken. Try a different one." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/jobs");
  revalidatePath("/my-listings");
  return { ok: true };
}

export type BidderProfileForListingResult =
  | { ok: true; profile: BidBidderProfileSummary }
  | { ok: false; error: string };

/**
 * Load a bidder’s public profile for the preview dialog. Allowed only if they have a bid on the listing.
 */
export async function getBidderProfileForListingBid(
  listingId: string,
  cleanerId: string
): Promise<BidderProfileForListingResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server error." };
  }

  const { data: bid } = await admin
    .from("bids")
    .select("id")
    .eq("listing_id", listingId)
    .eq("cleaner_id", cleanerId)
    .limit(1)
    .maybeSingle();

  if (!bid) {
    return { ok: false, error: "Bidder not found for this listing." };
  }

  const { data: row, error } = await admin
    .from("profiles")
    .select(BIDDER_PROFILE_SUMMARY_SELECT)
    .eq("id", cleanerId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "Profile not found." };
  }

  return { ok: true, profile: row as BidBidderProfileSummary };
}

export type HydrateBidderProfilesResult =
  | { ok: true; byId: Record<string, BidBidderProfileSummary> }
  | { ok: false; error: string };

/** Batch-load profiles for bid rows missing `bidder_profile` (e.g. after realtime INSERT). */
export async function hydrateBidderProfilesForListing(
  listingId: string,
  cleanerIds: string[]
): Promise<HydrateBidderProfilesResult> {
  const unique = [...new Set(cleanerIds.map((id) => String(id).trim()).filter(Boolean))];
  if (unique.length === 0) {
    return { ok: true, byId: {} };
  }

  const adminCheck = createSupabaseAdminClient();
  if (!adminCheck) {
    return { ok: false, error: "Server error." };
  }

  const { data: bidRows } = await adminCheck
    .from("bids")
    .select("cleaner_id")
    .eq("listing_id", listingId)
    .in("cleaner_id", unique);

  const allowed = new Set((bidRows ?? []).map((r) => String((r as { cleaner_id: string }).cleaner_id)));
  const toLoad = unique.filter((id) => allowed.has(id));
  if (toLoad.length === 0) {
    return { ok: true, byId: {} };
  }

  const { data: profs, error } = await adminCheck
    .from("profiles")
    .select(BIDDER_PROFILE_SUMMARY_SELECT)
    .in("id", toLoad);

  if (error) {
    return { ok: false, error: error.message };
  }

  const byId: Record<string, BidBidderProfileSummary> = {};
  for (const row of profs ?? []) {
    const id = String((row as { id: string }).id);
    byId[id] = row as BidBidderProfileSummary;
  }
  return { ok: true, byId };
}
