/**
 * Server-only recurring contract persistence. Uses Supabase admin/service patterns from callers.
 * See supabase/sql/20260418100000_recurring_contracts.sql for schema.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { listerPaymentDueAtFromNowIso } from "@/lib/jobs/lister-payment-deadline";
import {
  nextRecurringDate,
  parseDateOnly,
  type RecurringFrequencyKey,
} from "@/lib/recurring/recurring-schedule";
import { createNotification } from "@/lib/actions/notifications";

type AdminClient = SupabaseClient<Database>;

const FREQS = new Set(["weekly", "fortnightly", "monthly"]);

function asFreq(s: string | null | undefined): RecurringFrequencyKey | null {
  const v = String(s ?? "").trim();
  return FREQS.has(v) ? (v as RecurringFrequencyKey) : null;
}

async function mirrorListingNextDate(
  admin: AdminClient,
  listingId: string,
  dateStr: string | null
): Promise<void> {
  await admin
    .from("listings")
    .update({ recurring_next_occurrence_on: dateStr } as never)
    .eq("id", listingId);
}

export async function syncListingPausedFlag(
  admin: AdminClient,
  listingId: string,
  paused: boolean
): Promise<void> {
  await admin
    .from("listings")
    .update({ recurring_contract_paused: paused } as never)
    .eq("id", listingId);
}

export async function initializeRecurringContractForNewJob(
  admin: AdminClient,
  params: {
    listingId: string;
    listerId: string;
    cleanerId: string;
    jobId: number;
    agreedAmountCents: number;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: listing, error } = await admin
    .from("listings")
    .select(
      "id, service_type, recurring_frequency, recurring_series_start_date, recurring_series_end_date, recurring_series_max_occurrences, move_out_date, platform_fee_percentage, title"
    )
    .eq("id", params.listingId)
    .maybeSingle();

  if (error || !listing) return { ok: false, error: "Listing not found." };

  const serviceType = String((listing as { service_type?: string }).service_type ?? "");
  if (serviceType !== "recurring_house_cleaning") return { ok: true };

  const freq = asFreq((listing as { recurring_frequency?: string | null }).recurring_frequency);
  if (!freq) {
    return { ok: false, error: "Recurring listing is missing a valid frequency." };
  }

  const startRaw =
    (listing as { recurring_series_start_date?: string | null }).recurring_series_start_date ??
    (listing as { move_out_date?: string | null }).move_out_date;
  if (!startRaw) {
    return { ok: false, error: "Recurring listing needs a start date." };
  }

  const { data: existing } = await admin
    .from("recurring_contracts")
    .select("id")
    .eq("listing_id", params.listingId)
    .maybeSingle();
  if (existing) return { ok: true };

  const seriesEnd =
    (listing as { recurring_series_end_date?: string | null }).recurring_series_end_date ?? null;
  const maxOcc =
    (listing as { recurring_series_max_occurrences?: number | null }).recurring_series_max_occurrences ??
    null;
  const feePct = Number((listing as { platform_fee_percentage?: number }).platform_fee_percentage ?? 12);

  const { data: contract, error: cErr } = await admin
    .from("recurring_contracts")
    .insert({
      listing_id: params.listingId,
      lister_id: params.listerId,
      cleaner_id: params.cleanerId,
      frequency: freq,
      agreed_amount_cents: params.agreedAmountCents,
      platform_fee_percentage: feePct,
      series_start_date: startRaw,
      series_end_date: seriesEnd,
      max_occurrences: maxOcc,
      visits_completed: 0,
      next_occurrence_on: startRaw,
    } as never)
    .select("id")
    .maybeSingle();

  if (cErr || !contract) {
    return { ok: false, error: cErr?.message ?? "Failed to create recurring contract." };
  }

  const contractId = (contract as { id: string }).id;

  const { data: occ, error: oErr } = await admin
    .from("recurring_occurrences")
    .insert({
      contract_id: contractId,
      scheduled_date: startRaw,
      status: "in_progress",
      job_id: params.jobId,
    } as never)
    .select("id")
    .maybeSingle();

  if (oErr || !occ) {
    return { ok: false, error: oErr?.message ?? "Failed to create first occurrence." };
  }

  const occId = (occ as { id: string }).id;

  const { error: uErr } = await admin
    .from("jobs")
    .update({ recurring_occurrence_id: occId, updated_at: new Date().toISOString() } as never)
    .eq("id", params.jobId);

  if (uErr) return { ok: false, error: uErr.message };

  await mirrorListingNextDate(admin, params.listingId, startRaw);
  await syncListingPausedFlag(admin, params.listingId, false);

  return { ok: true };
}

function contractHitsCap(
  visitsAfterThis: number,
  maxOcc: number | null | undefined,
  nextDate: Date,
  endDate: Date | null
): boolean {
  if (maxOcc != null && maxOcc > 0 && visitsAfterThis >= maxOcc) return true;
  if (endDate && nextDate > endDate) return true;
  return false;
}

/**
 * After a recurring visit job is fully completed (funds released + status completed), roll the series forward.
 */
export type ScheduleNextRecurringResult = {
  nextJobId: number | null;
  nextVisitDate: string | null;
};

/**
 * Roll recurring series to the next visit: completes the current occurrence, inserts the next
 * scheduled occurrence, and creates the follow-up `jobs` row (accepted, awaiting lister payment).
 */
export async function scheduleNextRecurringVisitAfterJobCompleted(
  admin: AdminClient,
  completedJobId: number
): Promise<ScheduleNextRecurringResult> {
  const { data: job } = await admin
    .from("jobs")
    .select("id, listing_id, lister_id, winner_id, recurring_occurrence_id, status")
    .eq("id", completedJobId)
    .maybeSingle();

  const row = job as {
    id: number;
    listing_id: string;
    lister_id: string;
    winner_id: string | null;
    recurring_occurrence_id: string | null;
    status: string;
  } | null;

  if (!row?.recurring_occurrence_id || !row.listing_id || !row.winner_id) {
    return { nextJobId: null, nextVisitDate: null };
  }

  const { data: occ } = await admin
    .from("recurring_occurrences")
    .select("id, contract_id, scheduled_date, status")
    .eq("id", row.recurring_occurrence_id)
    .maybeSingle();

  const occRow = occ as {
    id: string;
    contract_id: string;
    scheduled_date: string;
    status: string;
  } | null;
  if (!occRow) {
    return { nextJobId: null, nextVisitDate: null };
  }

  const { data: contract } = await admin
    .from("recurring_contracts")
    .select(
      "id, listing_id, lister_id, cleaner_id, frequency, agreed_amount_cents, platform_fee_percentage, series_end_date, max_occurrences, visits_completed, paused_at, resume_scheduled_for"
    )
    .eq("id", occRow.contract_id)
    .maybeSingle();

  const c = contract as {
    id: string;
    listing_id: string;
    lister_id: string;
    cleaner_id: string | null;
    frequency: string;
    agreed_amount_cents: number;
    platform_fee_percentage: number;
    series_end_date: string | null;
    max_occurrences: number | null;
    visits_completed: number;
    paused_at: string | null;
    resume_scheduled_for: string | null;
  } | null;

  if (!c) {
    return { nextJobId: null, nextVisitDate: null };
  }

  const freq = asFreq(c.frequency);
  if (!freq) {
    return { nextJobId: null, nextVisitDate: null };
  }

  const nowIso = new Date().toISOString();
  const fromDate = parseDateOnly(occRow.scheduled_date) ?? new Date();
  let nextDate = nextRecurringDate(fromDate, freq);
  const endDate = parseDateOnly(c.series_end_date);
  const visitsNext = (c.visits_completed ?? 0) + 1;

  await admin
    .from("recurring_occurrences")
    .update({ status: "completed", updated_at: nowIso } as never)
    .eq("id", occRow.id);

  await admin
    .from("recurring_contracts")
    .update({
      visits_completed: visitsNext,
      updated_at: nowIso,
    } as never)
    .eq("id", c.id);

  if (c.paused_at) {
    const nextShow = c.resume_scheduled_for ?? null;
    await admin
      .from("recurring_contracts")
      .update({ next_occurrence_on: nextShow, updated_at: nowIso } as never)
      .eq("id", c.id);
    await mirrorListingNextDate(admin, c.listing_id, nextShow);
    return { nextJobId: null, nextVisitDate: null };
  }

  if (contractHitsCap(visitsNext, c.max_occurrences, nextDate, endDate)) {
    await admin
      .from("recurring_contracts")
      .update({ next_occurrence_on: null, updated_at: nowIso } as never)
      .eq("id", c.id);
    await mirrorListingNextDate(admin, c.listing_id, null);
    return { nextJobId: null, nextVisitDate: null };
  }

  if (endDate && nextDate > endDate) {
    await admin
      .from("recurring_contracts")
      .update({ next_occurrence_on: null, updated_at: nowIso } as never)
      .eq("id", c.id);
    await mirrorListingNextDate(admin, c.listing_id, null);
    return { nextJobId: null, nextVisitDate: null };
  }

  const nextDateStr = nextDate.toISOString().slice(0, 10);

  const { data: newOcc, error: insOccErr } = await admin
    .from("recurring_occurrences")
    .insert({
      contract_id: c.id,
      scheduled_date: nextDateStr,
      status: "scheduled",
    } as never)
    .select("id")
    .maybeSingle();

  if (insOccErr || !newOcc) {
    console.error("[recurring] insert occurrence failed", insOccErr);
    return { nextJobId: null, nextVisitDate: null };
  }

  const newOccId = (newOcc as { id: string }).id;

  const dueAt = listerPaymentDueAtFromNowIso();
  const { data: newJob, error: jobErr } = await admin
    .from("jobs")
    .insert({
      listing_id: c.listing_id,
      lister_id: c.lister_id,
      winner_id: c.cleaner_id ?? row.winner_id,
      status: "accepted",
      agreed_amount_cents: c.agreed_amount_cents,
      secured_via_buy_now: false,
      lister_payment_due_at: dueAt,
      recurring_occurrence_id: newOccId,
    } as never)
    .select("id")
    .maybeSingle();

  if (jobErr || !newJob) {
    console.error("[recurring] insert follow-up job failed", jobErr);
    return { nextJobId: null, nextVisitDate: null };
  }

  const newJobId = (newJob as { id: number }).id;

  await admin
    .from("recurring_occurrences")
    .update({ job_id: newJobId, status: "in_progress", updated_at: nowIso } as never)
    .eq("id", newOccId);

  await admin
    .from("recurring_contracts")
    .update({ next_occurrence_on: nextDateStr, updated_at: nowIso } as never)
    .eq("id", c.id);

  await mirrorListingNextDate(admin, c.listing_id, nextDateStr);

  const titleRow = await admin.from("listings").select("title").eq("id", c.listing_id).maybeSingle();
  const title = (titleRow.data as { title?: string } | null)?.title ?? "Recurring clean";

  try {
    await createNotification(
      c.lister_id,
      "recurring_next_visit",
      newJobId,
      `Next recurring clean scheduled for ${nextDateStr}. Pay & Start Job when you are ready to hold funds for this visit.`,
      { listingUuid: c.listing_id }
    );
  } catch (e) {
    console.error("[recurring] lister notify failed", e);
  }
  try {
    await createNotification(
      c.cleaner_id ?? row.winner_id,
      "recurring_next_visit",
      newJobId,
      `New recurring visit scheduled: ${title} on ${nextDateStr}. The lister will pay & start when ready.`,
      { listingUuid: c.listing_id, listingTitle: title }
    );
  } catch (e) {
    console.error("[recurring] cleaner notify failed", e);
  }

  return { nextJobId: newJobId, nextVisitDate: nextDateStr };
}

export async function notifyRecurringPauseResume(params: {
  contract: { lister_id: string; cleaner_id: string | null; listing_id: string };
  kind: "paused" | "resumed";
  reasonLine: string | null;
}): Promise<void> {
  const { contract, kind, reasonLine } = params;
  const msg =
    kind === "paused"
      ? `Recurring contract paused.${reasonLine ? ` ${reasonLine}` : ""}`
      : `Recurring contract resumed.${reasonLine ? ` ${reasonLine}` : ""}`;
  try {
    await createNotification(contract.lister_id, "recurring_contract", null, msg, {
      listingUuid: contract.listing_id,
    });
  } catch (e) {
    console.error("[recurring] pause notify lister", e);
  }
  if (contract.cleaner_id) {
    try {
      await createNotification(contract.cleaner_id, "recurring_contract", null, msg, {
        listingUuid: contract.listing_id,
      });
    } catch (e) {
      console.error("[recurring] pause notify cleaner", e);
    }
  }
}
