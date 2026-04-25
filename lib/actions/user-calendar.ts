"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDeepCleanServiceType } from "@/lib/service-types";

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
    .select("id, lister_id, service_type, preferred_dates, move_out_date")
    .eq("id", listingId)
    .maybeSingle();

  const L = listing as {
    id: string;
    lister_id: string;
    service_type: string | null;
    preferred_dates: unknown;
    move_out_date: string | null;
  } | null;
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

  if ("preferredDates" in input && isDeepCleanServiceType(L.service_type)) {
    const pd = patch.preferred_dates;
    if (Array.isArray(pd) && pd.length > 0 && typeof pd[0] === "string") {
      patch.move_out_date = String(pd[0]).trim().slice(0, 10);
    } else if (pd === null) {
      if (!("moveOutDate" in input)) {
        patch.move_out_date = null;
      }
    }
  }
  if ("moveOutDate" in input && isDeepCleanServiceType(L.service_type)) {
    const mo = normalizeDay(input.moveOutDate ?? null);
    if (mo) {
      patch.preferred_dates = [mo];
    }
  }

  const { error } = await admin.from("listings").update(patch as never).eq("id", listingId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/calendar");
  revalidatePath("/my-listings");
  revalidatePath("/lister/dashboard");
  revalidatePath("/cleaner/dashboard");
  revalidatePath("/find-jobs");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath(`/listings/${listingId}`);
  return { ok: true };
}

export type RelocateListingCalendarDateResult = { ok: true } | { ok: false; error: string };

/**
 * Move a single listing-backed calendar field (preferred / move-out / series start) to a new day.
 * Used by calendar drag-and-drop; keeps other preferred dates unchanged.
 */
export async function relocateListingCalendarDate(
  listingId: string,
  input: {
    fromDate: string;
    toDate: string;
    kind: "preferred" | "move_out" | "recurring_series_start";
  }
): Promise<RelocateListingCalendarDateResult> {
  const from = normalizeDay(input.fromDate);
  const to = normalizeDay(input.toDate);
  if (!from || !to) {
    return { ok: false, error: "Invalid date." };
  }
  if (from === to) {
    return { ok: true };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server configuration error." };

  const { data: listing } = await admin
    .from("listings")
    .select("id, lister_id, preferred_dates, move_out_date, recurring_series_start_date, service_type")
    .eq("id", listingId)
    .maybeSingle();

  const L = listing as {
    id: string;
    lister_id: string;
    preferred_dates: unknown;
    move_out_date: string | null;
    recurring_series_start_date: string | null;
    service_type: string | null;
  } | null;

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
      error: "Dates can only be moved while the job is active (not completed or cancelled).",
    };
  }

  const patch: Record<string, unknown> = {};

  if (input.kind === "preferred") {
    const raw = L.preferred_dates;
    const arr = Array.isArray(raw)
      ? raw.map((s) => String(s ?? "").trim().slice(0, 10)).filter((s) => DATE_RE.test(s))
      : [];
    if (!arr.includes(from)) {
      return { ok: false, error: "That preferred date is no longer on the listing." };
    }
    const merged = new Set(arr.filter((d) => d !== from));
    merged.add(to);
    patch.preferred_dates = sanitizeDateList([...merged]);
    if (isDeepCleanServiceType(L.service_type)) {
      patch.move_out_date = to;
    }
  } else if (input.kind === "move_out") {
    const cur = normalizeDay(L.move_out_date);
    if (cur !== from) {
      return { ok: false, error: "Move-out date no longer matches — refresh and try again." };
    }
    patch.move_out_date = to;
  } else {
    const cur = normalizeDay(L.recurring_series_start_date);
    if (cur !== from) {
      return { ok: false, error: "Series start date no longer matches — refresh and try again." };
    }
    patch.recurring_series_start_date = to;
  }

  const { error } = await admin.from("listings").update(patch as never).eq("id", listingId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/calendar");
  revalidatePath("/my-listings");
  revalidatePath("/lister/dashboard");
  revalidatePath("/cleaner/dashboard");
  revalidatePath("/find-jobs");
  revalidatePath(`/jobs/${listingId}`);
  revalidatePath(`/listings/${listingId}`);
  return { ok: true };
}
