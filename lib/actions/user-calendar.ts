"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeDateList(raw: string[] | null | undefined): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out = uniq(
    raw
      .map((s) => String(s ?? "").trim().slice(0, 10))
      .filter((s) => DATE_RE.test(s))
  ).slice(0, 24);
  return out.length > 0 ? out : null;
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr)];
}

function normalizeDay(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().slice(0, 10);
  return DATE_RE.test(s) ? s : null;
}

function jobAllowsCleaningDateEdits(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s !== "cancelled" && s !== "cancelled_by_lister" && s !== "completed";
}

export type UpdateListingCleaningDatesResult = { ok: true } | { ok: false; error: string };

/**
 * Lister-only: set preferred date window / move-out / series start when the listing has a non-terminal job.
 */
export async function updateListingCleaningDates(
  listingId: string,
  input: {
    preferredDates?: string[] | null;
    moveOutDate?: string | null;
    recurringSeriesStartDate?: string | null;
  }
): Promise<UpdateListingCleaningDatesResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server configuration error." };

  const { data: listing } = await admin
    .from("listings")
    .select("id, lister_id")
    .eq("id", listingId)
    .maybeSingle();

  const L = listing as { id: string; lister_id: string } | null;
  if (!L || L.lister_id !== user.id) {
    return { ok: false, error: "Listing not found or you are not the lister." };
  }

  const { data: jobs } = await admin
    .from("jobs")
    .select("id, status")
    .eq("listing_id", listingId);

  const hasEditableJob = (jobs ?? []).some((j) =>
    jobAllowsCleaningDateEdits((j as { status?: string }).status)
  );
  if (!hasEditableJob) {
    return {
      ok: false,
      error: "Add or keep an active job first — cleaning dates can be updated while work is in progress.",
    };
  }

  const patch: Record<string, unknown> = {};

  if ("preferredDates" in input) {
    patch.preferred_dates = sanitizeDateList(input.preferredDates ?? null);
  }
  if ("moveOutDate" in input) {
    patch.move_out_date = normalizeDay(input.moveOutDate ?? null);
  }
  if ("recurringSeriesStartDate" in input) {
    patch.recurring_series_start_date = normalizeDay(input.recurringSeriesStartDate ?? null);
  }

  const { error } = await admin.from("listings").update(patch as never).eq("id", listingId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/calendar");
  revalidatePath("/my-listings");
  revalidatePath("/lister/dashboard");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath(`/listings/${listingId}`);
  return { ok: true };
}
