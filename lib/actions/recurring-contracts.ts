"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  initializeRecurringContractForNewJob,
  notifyRecurringPauseResume,
  scheduleNextRecurringVisitAfterJobCompleted,
  syncListingPausedFlag,
} from "@/lib/recurring/recurring-contract-internal";
import {
  nextRecurringDate,
  parseDateOnly,
  type RecurringFrequencyKey,
} from "@/lib/recurring/recurring-schedule";
import {
  parseRecurringSkipReason,
  recurringSkipReasonLabel,
} from "@/lib/recurring/recurring-reasons";
import { sendEmail } from "@/lib/notifications/email";
import { getEmailForUserId } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site";
import { trimStr } from "@/lib/utils";
import type { CreateNotificationOptions, NotificationType } from "@/lib/actions/notifications";
import { isJobCancelledStatus } from "@/lib/jobs/job-status-helpers";

export type RecurringActionResult = { ok: true } | { ok: false; error: string };

/** Lister pauses the contract — no new visit jobs until {@link resumeRecurringContract}. */
export async function pauseRecurringContract(
  listingId: string,
  input: {
    reasonKey: string;
    reasonDetail?: string | null;
    /** Optional: show “Paused • Will resume on …” in UI. */
    resumeScheduledFor?: string | null;
  }
): Promise<RecurringActionResult> {
  const parsed = parseRecurringSkipReason(input.reasonKey, input.reasonDetail);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server configuration error." };

  const { data: contract } = await admin
    .from("recurring_contracts")
    .select("id, lister_id, cleaner_id, listing_id, frequency")
    .eq("listing_id", listingId)
    .maybeSingle();

  const c = contract as {
    id: string;
    lister_id: string;
    cleaner_id: string | null;
    listing_id: string;
    frequency: string;
  } | null;

  if (!c || c.lister_id !== user.id) {
    return { ok: false, error: "Contract not found or access denied." };
  }

  const nowIso = new Date().toISOString();
  const resume = input.resumeScheduledFor?.trim() || null;

  const { error } = await admin
    .from("recurring_contracts")
    .update({
      paused_at: nowIso,
      resume_scheduled_for: resume,
      updated_at: nowIso,
    } as never)
    .eq("id", c.id);

  if (error) return { ok: false, error: error.message };

  await syncListingPausedFlag(admin, listingId, true);
  await admin
    .from("listings")
    .update({ recurring_next_occurrence_on: resume } as never)
    .eq("id", listingId);

  const reasonLine = `${recurringSkipReasonLabel(parsed.key)}${parsed.detail ? ` — ${parsed.detail}` : ""}`;
  await notifyRecurringPauseResume({
    contract: { lister_id: c.lister_id, cleaner_id: c.cleaner_id, listing_id: c.listing_id },
    kind: "paused",
    reasonLine,
  });

  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("email_force_disabled")
      .eq("id", c.cleaner_id ?? "")
      .maybeSingle();
    if (c.cleaner_id && !(prof as { email_force_disabled?: boolean } | null)?.email_force_disabled) {
      const to = await getEmailForUserId(c.cleaner_id);
      if (to) {
        const origin = getSiteUrl().origin;
        await sendEmail(
          to,
          `[Bond Back] Recurring clean paused`,
          `<p>The lister paused the recurring contract.</p><p><strong>Reason:</strong> ${reasonLine}</p><p><a href="${origin}/jobs">Open dashboard</a></p>`,
          { log: { userId: c.cleaner_id, kind: "recurring_pause_cleaner" } }
        );
      }
    }
  } catch (e) {
    console.error("[recurring] pause email", e);
  }

  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/my-listings");
  revalidatePath("/lister/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function resumeRecurringContract(listingId: string): Promise<RecurringActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server configuration error." };

  const { data: contract } = await admin
    .from("recurring_contracts")
    .select("id, lister_id, cleaner_id, listing_id, next_occurrence_on")
    .eq("listing_id", listingId)
    .maybeSingle();

  const c = contract as {
    id: string;
    lister_id: string;
    cleaner_id: string | null;
    listing_id: string;
    next_occurrence_on: string | null;
  } | null;

  if (!c || c.lister_id !== user.id) {
    return { ok: false, error: "Contract not found or access denied." };
  }

  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("recurring_contracts")
    .update({
      paused_at: null,
      resume_scheduled_for: null,
      updated_at: nowIso,
    } as never)
    .eq("id", c.id);

  if (error) return { ok: false, error: error.message };

  await syncListingPausedFlag(admin, listingId, false);
  await admin
    .from("listings")
    .update({ recurring_next_occurrence_on: c.next_occurrence_on } as never)
    .eq("id", listingId);

  await notifyRecurringPauseResume({
    contract: { lister_id: c.lister_id, cleaner_id: c.cleaner_id, listing_id: c.listing_id },
    kind: "resumed",
    reasonLine: null,
  });

  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/my-listings");
  revalidatePath("/jobs");
  return { ok: true };
}

/** Skip a future occurrence that has no job yet. */
export async function skipRecurringOccurrence(
  occurrenceId: string,
  input: { reasonKey: string; reasonDetail?: string | null }
): Promise<RecurringActionResult> {
  const parsed = parseRecurringSkipReason(input.reasonKey, input.reasonDetail);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server configuration error." };

  const { data: occ } = await admin
    .from("recurring_occurrences")
    .select("id, contract_id, scheduled_date, status, job_id")
    .eq("id", occurrenceId)
    .maybeSingle();

  const o = occ as {
    id: string;
    contract_id: string;
    scheduled_date: string;
    status: string;
    job_id: number | null;
  } | null;

  if (!o || o.status !== "scheduled" || o.job_id != null) {
    return { ok: false, error: "Only a scheduled visit without a job can be skipped." };
  }

  const { data: contract } = await admin
    .from("recurring_contracts")
    .select("id, lister_id, cleaner_id, listing_id, frequency, paused_at")
    .eq("id", o.contract_id)
    .maybeSingle();

  const c = contract as {
    id: string;
    lister_id: string;
    cleaner_id: string | null;
    listing_id: string;
    frequency: string;
    paused_at: string | null;
  } | null;

  if (!c || c.lister_id !== user.id) {
    return { ok: false, error: "Only the lister can skip a visit." };
  }

  if (c.paused_at) {
    return { ok: false, error: "Resume the contract before changing occurrences." };
  }

  const freq = String(c.frequency) as RecurringFrequencyKey;
  const from = parseDateOnly(o.scheduled_date) ?? new Date();
  const nextD = nextRecurringDate(from, freq);
  const nextStr = nextD.toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const { error: u1 } = await admin
    .from("recurring_occurrences")
    .update({
      status: "skipped",
      skip_reason_key: parsed.key,
      skip_reason_detail: parsed.detail,
      updated_at: nowIso,
    } as never)
    .eq("id", o.id);

  if (u1) return { ok: false, error: u1.message };

  const { error: insErr } = await admin.from("recurring_occurrences").insert({
    contract_id: c.id,
    scheduled_date: nextStr,
    status: "scheduled",
  } as never);

  if (insErr) return { ok: false, error: insErr.message };

  await admin
    .from("recurring_contracts")
    .update({ next_occurrence_on: nextStr, updated_at: nowIso } as never)
    .eq("id", c.id);

  await admin
    .from("listings")
    .update({ recurring_next_occurrence_on: nextStr } as never)
    .eq("id", c.listing_id);

  const reasonLine = `${recurringSkipReasonLabel(parsed.key)}${parsed.detail ? ` — ${parsed.detail}` : ""}`;
  const otherId = c.cleaner_id;
  if (otherId) {
    try {
      await createNotificationWrapper(
        otherId,
        "recurring_occurrence_skipped",
        null,
        `A recurring visit was skipped. Next: ${nextStr}. ${reasonLine}`,
        { listingUuid: c.listing_id }
      );
    } catch (e) {
      console.error("[recurring] skip notify", e);
    }
  }

  revalidatePath(`/listings/${c.listing_id}`);
  revalidatePath("/jobs");
  revalidatePath("/calendar");
  return { ok: true };
}

async function createNotificationWrapper(
  userId: string,
  type: NotificationType,
  jobId: number | null,
  message: string,
  options: CreateNotificationOptions
): Promise<void> {
  const { createNotification } = await import("@/lib/actions/notifications");
  await createNotification(userId, type, jobId, message, options);
}

/** "This visit" vs shift the long-term series anchor (e.g. every Tuesday → every Thursday). */
export type RecurringRescheduleMode = "this_visit_only" | "update_series";

function jobAllowsRecurringReschedule(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  if (s.length === 0) return false;
  if (s === "completed" || isJobCancelledStatus(s)) return false;
  if (s === "disputed" || s === "dispute_negotiating") return false;
  return true;
}

/**
 * Lister reschedules a recurring visit. Works for scheduled (no job / awaiting pay) and active visit jobs;
 * "this_visit_only" keeps the original cadence for future dates after this job completes; "update_series"
 * also updates the contract/listing series anchor so the new weekday repeats.
 */
export async function moveRecurringOccurrence(
  occurrenceId: string,
  newDateIso: string,
  input: {
    reasonKey: string;
    reasonDetail?: string | null;
    /** @default "update_series" — matches drag-and-previous one-off-occurrence move semantics. */
    mode?: RecurringRescheduleMode;
  }
): Promise<RecurringActionResult> {
  const parsed = parseRecurringSkipReason(input.reasonKey, input.reasonDetail);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const d = trimStr(newDateIso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return { ok: false, error: "Invalid date." };
  }

  const mode: RecurringRescheduleMode = input.mode ?? "update_series";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server configuration error." };

  const { data: occ } = await admin
    .from("recurring_occurrences")
    .select("id, contract_id, scheduled_date, status, job_id")
    .eq("id", occurrenceId)
    .maybeSingle();

  const o = occ as {
    id: string;
    contract_id: string;
    scheduled_date: string;
    status: string;
    job_id: number | null;
  } | null;

  if (!o) {
    return { ok: false, error: "Visit not found." };
  }
  if (o.status === "completed" || o.status === "skipped") {
    return { ok: false, error: "This visit is already finished or was skipped." };
  }
  if (o.status !== "scheduled" && o.status !== "in_progress") {
    return { ok: false, error: "This visit cannot be rescheduled." };
  }

  if (o.job_id != null) {
    const { data: jRow } = await admin
      .from("jobs")
      .select("id, status")
      .eq("id", o.job_id)
      .maybeSingle();
    const job = jRow as { id: number; status: string } | null;
    if (!job || !jobAllowsRecurringReschedule(job.status)) {
      return { ok: false, error: "Reschedule is not available for this job in its current state." };
    }
  } else {
    if (o.status === "in_progress") {
      return { ok: false, error: "Inconsistent visit state. Please contact support." };
    }
  }

  const { data: contract } = await admin
    .from("recurring_contracts")
    .select("id, lister_id, listing_id, paused_at")
    .eq("id", o.contract_id)
    .maybeSingle();

  const c = contract as {
    id: string;
    lister_id: string;
    listing_id: string;
    paused_at: string | null;
  } | null;

  if (!c || c.lister_id !== user.id) {
    return { ok: false, error: "Only the lister can move a visit." };
  }

  if (c.paused_at) {
    return { ok: false, error: "Resume the contract before rescheduling." };
  }

  const nowIso = new Date().toISOString();
  const oldDate = o.scheduled_date;
  const oneOffResume =
    mode === "this_visit_only" ? oldDate : null;

  const { error } = await admin
    .from("recurring_occurrences")
    .update({
      scheduled_date: d,
      skip_reason_key: parsed.key,
      skip_reason_detail: parsed.detail,
      one_off_pattern_resume_from: oneOffResume,
      updated_at: nowIso,
    } as never)
    .eq("id", o.id);

  if (error) return { ok: false, error: error.message };

  if (mode === "update_series") {
    const { error: cErr } = await admin
      .from("recurring_contracts")
      .update({
        series_start_date: d,
        next_occurrence_on: d,
        updated_at: nowIso,
      } as never)
      .eq("id", c.id);
    if (cErr) return { ok: false, error: cErr.message };
    const { error: lErr } = await admin
      .from("listings")
      .update({
        recurring_series_start_date: d,
        recurring_next_occurrence_on: d,
      } as never)
      .eq("id", c.listing_id);
    if (lErr) return { ok: false, error: lErr.message };
  } else {
    const { error: cErr } = await admin
      .from("recurring_contracts")
      .update({ next_occurrence_on: d, updated_at: nowIso } as never)
      .eq("id", c.id);
    if (cErr) return { ok: false, error: cErr.message };
    const { error: lErr } = await admin
      .from("listings")
      .update({ recurring_next_occurrence_on: d } as never)
      .eq("id", c.listing_id);
    if (lErr) return { ok: false, error: lErr.message };
  }

  revalidatePath(`/listings/${c.listing_id}`);
  revalidatePath("/jobs");
  revalidatePath("/calendar");
  revalidatePath("/my-listings");
  revalidatePath("/lister/dashboard");
  revalidatePath("/cleaner/dashboard");
  revalidatePath("/find-jobs");
  return { ok: true };
}

export { initializeRecurringContractForNewJob, scheduleNextRecurringVisitAfterJobCompleted };
