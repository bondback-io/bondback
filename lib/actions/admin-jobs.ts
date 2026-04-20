"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe";
import { createNotification, sendPaymentReceiptEmails } from "@/lib/actions/notifications";
import { logAdminActivity } from "@/lib/admin-activity-log";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { fetchPlatformFeePercentForListing } from "@/lib/platform-fee";
import { releaseJobFunds, executeRefund } from "@/lib/actions/jobs";
import { insertDisputeThreadEntry } from "@/lib/disputes/dispute-thread-and-notify";
import { recomputeVerificationBadgesForUser } from "@/lib/actions/verification";
import { applyReferralRewardsForCompletedJob } from "@/lib/actions/referral-rewards";
import { adminDeleteListingByIdCascade } from "@/lib/actions/admin-listings";

async function requireAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  adminId: string;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!adminProfile || !(adminProfile as any).is_admin) throw new Error("Not authorised");
  return { supabase, adminId: session.user.id };
}

export async function adminForceCompleteJob(formData: FormData): Promise<void> {
  const jobId = formData.get("jobId");
  if (!jobId) return;
  const { supabase, adminId } = await requireAdmin();
  const { error } = await supabase
    .from("jobs")
    .update({ status: "completed", completed_at: new Date().toISOString() } as never)
    .eq("id", Number(jobId));
  if (error) return;
  await logAdminActivity({ adminId, actionType: "job_force_complete", targetType: "job", targetId: String(jobId), details: {} });

  revalidatePath("/admin/jobs");
  revalidatePath("/dashboard");
}

export async function adminReinstateJob(formData: FormData): Promise<void> {
  const jobId = formData.get("jobId");
  if (!jobId) return;
  const { supabase, adminId } = await requireAdmin();
  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("id", Number(jobId))
    .maybeSingle();

  if (fetchError || !job) {
    return;
  }

  // Simple rule: completed -> in_progress, disputed/in_review -> in_progress, otherwise leave as-is.
  const currentStatus = (job as { status: string }).status;
  let nextStatus = currentStatus;
  if (currentStatus === "completed") {
    nextStatus = "in_progress";
  } else if (currentStatus === "disputed" || currentStatus === "in_review") {
    nextStatus = "in_progress";
  }

  if (nextStatus === currentStatus) {
    return;
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ status: nextStatus } as never)
    .eq("id", Number(jobId));

  if (updateError) {
    return;
  }

  await logAdminActivity({ adminId, actionType: "job_reinstate", targetType: "job", targetId: String(jobId), details: { from: currentStatus, to: nextStatus } });

  revalidatePath("/admin/jobs");
  revalidatePath("/dashboard");
}

export type RefundJobResult = { ok: true } | { ok: false; error: string };

/**
 * Admin confirms refund: create Stripe refund, update job refund_amount/refund_status/status, notify parties.
 * Uses job.payment_intent_id. For Stripe Connect, pass stripeAccount if payment is on connected account.
 */
export async function refundJob(
  jobId: number,
  amountCents: number
): Promise<RefundJobResult> {
  const { supabase, adminId } = await requireAdmin();

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, payment_intent_id, proposed_refund_amount, counter_proposal_amount")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) {
    return { ok: false, error: "Job not found." };
  }

  const j = job as {
    status: string;
    lister_id: string;
    winner_id: string | null;
    payment_intent_id: string | null;
    proposed_refund_amount: number | null;
    counter_proposal_amount: number | null;
  };

  if (!j.payment_intent_id?.trim()) {
    return { ok: false, error: "Job has no payment_intent_id. Refund cannot be processed via Stripe." };
  }

  const amount = Math.round(amountCents);
  if (amount < 1) {
    return { ok: false, error: "Refund amount must be at least 1 cent." };
  }

  try {
    const stripe = await getStripeServer();
    const refund = await stripe.refunds.create({
      payment_intent: j.payment_intent_id,
      amount,
      reason: "requested_by_customer",
      metadata: { job_id: String(jobId) },
    });

    const nowIso = new Date().toISOString();
    const refundStatus = refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "pending";
    /** Use `completed` so lister/cleaner dashboards show the job under Completed (not legacy `refunded`). */
    const statusUpdate = refundStatus === "succeeded" ? "completed" : j.status;

    const updatePayload: Record<string, unknown> = {
      refund_amount: amount,
      refund_status: refundStatus,
      status: statusUpdate,
      dispute_resolution: "refund",
      resolution_at: nowIso,
      resolution_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    };
    if (refundStatus === "succeeded") {
      updatePayload.dispute_status = "completed";
    }

    const { error: updateError } = await supabase
      .from("jobs")
      .update(updatePayload as never)
      .eq("id", jobId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    const msg = `Refund of $${(amount / 100).toFixed(0)} has been processed.`;
    if (j.lister_id) {
      await createNotification(j.lister_id, "payment_released", jobId, msg);
    }
    if (j.winner_id) {
      await createNotification(j.winner_id, "payment_released", jobId, msg);
    }
    await logAdminActivity({ adminId, actionType: "job_refund", targetType: "job", targetId: String(jobId), details: { amountCents: amount, refundStatus } });

    revalidatePath("/admin/disputes");
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/lister/dashboard");
    revalidatePath("/cleaner/dashboard");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe refund failed.";
    return { ok: false, error: message };
  }
}

/** Legacy form-based entry point; extracts jobId and amountCents from FormData. */
export async function adminRefundJob(formData: FormData): Promise<void> {
  const jobId = formData.get("jobId");
  const amountCents = formData.get("amountCents");
  if (!jobId) {
    return;
  }
  const amount = amountCents ? Math.round(Number(amountCents)) : undefined;
  if (amount === undefined || amount < 1) {
    return;
  }
  await refundJob(Number(jobId), amount);
  revalidatePath("/admin/jobs");
}

export async function adminResolveDispute(formData: FormData): Promise<void> {
  const jobId = formData.get("jobId");
  const resolution = formData.get("resolution") as
    | "release_funds"
    | "partial_refund"
    | "full_refund"
    | "reject"
    | "return_to_review"
    | null;
  if (!jobId || !resolution) return;
  const { supabase, adminId } = await requireAdmin();

  const nowIso = new Date().toISOString();

  const numericJobId = Number(jobId);
  const refundAmountRaw =
    formData.get("refundAmountCents") ?? formData.get("amountCents");
  const refundAmountCents =
    refundAmountRaw != null ? Math.max(0, Math.round(Number(refundAmountRaw))) : null;

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select(
      "id, lister_id, winner_id, listing_id, status, payment_intent_id, payment_released_at, agreed_amount_cents, stripe_transfer_id"
    )
    .eq("id", numericJobId)
    .maybeSingle();

  if (fetchError || !job) {
    return;
  }

  const j = job as {
    id: number;
    lister_id: string;
    winner_id: string | null;
    listing_id: string | null;
    status: string;
    agreed_amount_cents: number | null;
    payment_released_at?: string | null;
    payment_intent_id?: string | null;
  };

  /** Resume lister review with a fresh auto-release window — no Stripe movement. */
  if (resolution === "return_to_review") {
    if (!["disputed", "in_review", "dispute_negotiating"].includes(j.status)) {
      return;
    }
    const settings = await getGlobalSettings();
    const hrs = settings?.auto_release_hours ?? 48;
    const newIso = new Date(Date.now() + hrs * 60 * 60 * 1000).toISOString();
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "completed_pending_approval",
        dispute_resolution: "return_to_review",
        resolution_type: "return_to_review",
        resolution_at: nowIso,
        resolution_by: adminId,
        dispute_status: "resolved",
        auto_release_at: newIso,
        auto_release_at_original: newIso,
      } as never)
      .eq("id", numericJobId);

    if (updateError) return;

    const msg =
      "Admin closed the dispute and restarted the review window. Approve payment or wait for auto-release.";
    if (j.lister_id) await createNotification(j.lister_id, "dispute_resolved", numericJobId, msg);
    if (j.winner_id) await createNotification(j.winner_id, "dispute_resolved", numericJobId, msg);

    await insertDisputeThreadEntry({
      jobId: numericJobId,
      authorUserId: adminId,
      authorRole: "admin",
      body: `Admin resolution: return_to_review — lister review timer reset (${hrs}h).`,
      visibility: { lister: true, cleaner: true },
    });

    await logAdminActivity({
      adminId,
      actionType: "dispute_resolved",
      targetType: "job",
      targetId: String(numericJobId),
      details: { resolution: "return_to_review", new_auto_release_at: newIso },
    });

    revalidatePath("/admin/disputes");
    revalidatePath("/disputes");
    revalidatePath("/dashboard");
    revalidatePath(`/jobs/${numericJobId}`);
    return;
  }

  // Ensure payout/refund happens when PaymentIntent is still held (manual capture).
  if (resolution === "release_funds" || resolution === "reject") {
    const releaseResult = await releaseJobFunds(numericJobId);
    if (!releaseResult.ok) return;
  }

  if (resolution === "partial_refund" || resolution === "full_refund") {
    const settings = await getGlobalSettings();
    const agreedCents = j.agreed_amount_cents ?? 0;
    const feePct =
      (await fetchPlatformFeePercentForListing(supabase, j.listing_id, settings)) / 100;
    const feeCents = Math.round(agreedCents * feePct);

    const refundTotalCents =
      resolution === "full_refund" ? agreedCents + feeCents : refundAmountCents ?? 0;

    if (!refundTotalCents || refundTotalCents < 1) {
      return;
    }

    const refundResult = await executeRefund(numericJobId, refundTotalCents);
    if (!refundResult.ok) return;
  }

  const updatePayload: Record<string, unknown> = {
    status:
      resolution === "full_refund" ? "cancelled" : "completed",
    completed_at: nowIso,
    dispute_resolution: resolution,
    resolution_type: resolution,
    resolution_at: nowIso,
    resolution_by: adminId,
    dispute_status: resolution === "full_refund" ? "cancelled" : "completed",
  };

  const { error: updateError } = await supabase
    .from("jobs")
    .update(updatePayload as never)
    .eq("id", numericJobId);

  if (updateError) return;

  if (j.listing_id) {
    await supabase
      .from("listings")
      .update({ status: "ended" } as never)
      .eq("id", j.listing_id);
  }

  const msg = `Admin resolved dispute (${resolution}). Funds updated accordingly.`;
  if (j.lister_id) await createNotification(j.lister_id, "dispute_resolved", numericJobId, msg);
  if (j.winner_id) await createNotification(j.winner_id, "dispute_resolved", numericJobId, msg);

  if (j.winner_id) await recomputeVerificationBadgesForUser(j.winner_id);
  if (j.lister_id) await recomputeVerificationBadgesForUser(j.lister_id);

  const auditRefund =
    resolution === "partial_refund" && refundAmountCents != null && refundAmountCents > 0
      ? ` Refund to lister: $${(refundAmountCents / 100).toFixed(2)} AUD.`
      : "";
  await insertDisputeThreadEntry({
    jobId: numericJobId,
    authorUserId: adminId,
    authorRole: "admin",
    body: `Admin resolution: ${resolution}.${auditRefund}`,
    visibility: { lister: true, cleaner: true },
  });

  await logAdminActivity({
    adminId,
    actionType: "dispute_resolved",
    targetType: "job",
    targetId: String(numericJobId),
    details: {
      resolution,
      refundAmountCents,
    },
  });

  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${numericJobId}`);
}

export async function adminDeleteJob(formData: FormData): Promise<void> {
  const jobIdRaw = formData.get("jobId");
  if (!jobIdRaw) throw new Error("Missing jobId");
  const jobId = Number(jobIdRaw);
  const { adminId } = await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error(
      "Admin delete requires SUPABASE_SERVICE_ROLE_KEY so listers see updates."
    );
  }
  const db = admin;

  const { data: job } = await db
    .from("jobs")
    .select("id, listing_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) throw new Error("Job not found");
  const listingId = String((job as { listing_id?: string | null }).listing_id ?? "").trim();
  if (!listingId) throw new Error("Job has no linked listing_id");

  // Requirement: deleting a job from admin also removes the linked listing and linked jobs.
  await adminDeleteListingByIdCascade(listingId, adminId);
  await logAdminActivity({
    adminId,
    actionType: "job_deleted",
    targetType: "job",
    targetId: String(jobId),
    details: { cascadeListingId: listingId },
  });

  revalidatePath("/admin/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/lister/dashboard");
  revalidatePath("/my-listings");
}

export async function adminResetAllJobs(formData: FormData): Promise<void> {
  const confirmed = formData.get("confirm") === "on";
  const double = formData.get("confirmText");
  if (!confirmed || (double as string)?.toLowerCase() !== "delete") {
    return;
  }
  const { supabase, adminId } = await requireAdmin();
  const { data: jobs } = await supabase.from("jobs").select("id");
  const ids = (jobs ?? []).map((j: { id: number }) => j.id);
  for (const id of ids) {
    const fd = new FormData();
    fd.set("jobId", String(id));
    try {
       
      await adminDeleteJob(fd);
    } catch {
      /* continue bulk reset */
    }
  }
  await logAdminActivity({ adminId, actionType: "jobs_reset_all", targetType: "job", targetId: null, details: { count: ids.length } });
  revalidatePath("/admin/jobs");
}

export type OverrideTimerActionType =
  | "force_release_now"
  | "shorten_timer"
  | "extend_timer"
  | "cancel_override"
  | "pause_timer";

export type OverrideTimerResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Admin override for the 48-hour review window:
 * - force_release_now: immediately capture payment + transfer to cleaner, then mark completed
 * - shorten_timer: set auto_release_at to `now + hoursLeft`
 * - extend_timer: add `hours` to current auto_release_at (or original / fallback)
 * - cancel_override: revert auto_release_at back to auto_release_at_original (or baseline)
 * - pause_timer: clear auto_release_at and auto_release_at_original (auto-release paused until reset)
 *
 * Logs to `admin_activity_log` with `action_type = 'timer_override'`.
 */
export async function overrideTimer(
  jobId: number,
  actionType: OverrideTimerActionType,
  hours: number | null,
  reason: string
): Promise<OverrideTimerResult> {
  const safeReason = String(reason ?? "").trim();
  if (!safeReason) {
    return { ok: false, error: "Reason is required." };
  }

  if (!Number.isFinite(jobId) || jobId < 1) {
    return { ok: false, error: "Invalid jobId." };
  }

  const { supabase, adminId } = await requireAdmin();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(
      "id, status, listing_id, lister_id, winner_id, agreed_amount_cents, payment_released_at, auto_release_at, auto_release_at_original, cleaner_confirmed_at, cleaner_confirmed_complete"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, error: jobError?.message ?? "Job not found." };
  }

  const row = job as {
    status: string;
    payment_released_at?: string | null;
    auto_release_at?: string | null;
    auto_release_at_original?: string | null;
    cleaner_confirmed_at?: string | null;
    cleaner_confirmed_complete?: boolean | null;
    listing_id: string;
    lister_id: string;
    winner_id: string | null;
    agreed_amount_cents: number | null;
  };

  if (row.status !== "completed_pending_approval") {
    return {
      ok: false,
      error: `Job is not in completed_pending_approval (current: ${row.status}).`,
    };
  }

  if (row.payment_released_at) {
    return { ok: false, error: "Payment has already been released." };
  }

  const nowIso = new Date().toISOString();
  const prevAutoReleaseAt = row.auto_release_at ?? null;
  const prevAutoReleaseAtOriginal = row.auto_release_at_original ?? null;

  const settings = await getGlobalSettings();
  const autoReleaseHours = settings?.auto_release_hours ?? 48;
  const feePercent =
    (await fetchPlatformFeePercentForListing(supabase, row.listing_id, settings)) / 100;

  const computeBaselineIso = () => {
    if (row.auto_release_at_original) return row.auto_release_at_original;
    if (!row.cleaner_confirmed_at) return null;
    const baseMs =
      new Date(row.cleaner_confirmed_at).getTime() +
      autoReleaseHours * 60 * 60 * 1000;
    return new Date(baseMs).toISOString();
  };

  const computeAutoReleaseMs = () => {
    const atIso = row.auto_release_at ?? computeBaselineIso();
    return atIso ? new Date(atIso).getTime() : null;
  };

  // Force release now: run escrow release + mark completed
  if (actionType === "force_release_now") {
    const releaseResult = await releaseJobFunds(jobId);
    if (!releaseResult.ok) {
      return { ok: false, error: releaseResult.error };
    }

    const { error: statusErr } = await supabase
      .from("jobs")
      .update({ status: "completed", completed_at: nowIso, updated_at: nowIso } as never)
      .eq("id", jobId);

    if (statusErr) {
      return { ok: false, error: statusErr.message };
    }

    if (row.listing_id) {
      const { error: listingErr } = await supabase
        .from("listings")
        .update({ status: "ended" } as never)
        .eq("id", row.listing_id);
      if (listingErr) {
        return { ok: false, error: listingErr.message };
      }
    }

    // Notify winner + send lister/cleaner receipts (same approach as auto-release)
    if (row.winner_id) {
      await createNotification(
        row.winner_id,
        "payment_released",
        jobId,
        "Payment was released by an admin timer override. Funds are on the way to your connected account."
      );
    }

    if (row.winner_id) await recomputeVerificationBadgesForUser(row.winner_id);
    if (row.lister_id) await recomputeVerificationBadgesForUser(row.lister_id);

    const agreedCents = row.agreed_amount_cents ?? 0;
    if (agreedCents >= 1 && row.lister_id && row.winner_id) {
      const feeCents = Math.round(agreedCents * feePercent);
      const totalCents = agreedCents + feeCents;
      let jobTitle: string | null = null;
      if (row.listing_id) {
        const { data: listing } = await supabase
          .from("listings")
          .select("title")
          .eq("id", row.listing_id)
          .maybeSingle();
        jobTitle = (listing as { title?: string } | null)?.title ?? null;
      }

      await sendPaymentReceiptEmails({
        jobId,
        listerId: row.lister_id,
        cleanerId: row.winner_id,
        amountCents: totalCents,
        feeCents,
        netCents: agreedCents,
        jobTitle,
        dateIso: nowIso,
      });
    }

    await applyReferralRewardsForCompletedJob(jobId);

    await logAdminActivity({
      adminId,
      actionType: "timer_override",
      targetType: "job",
      targetId: String(jobId),
      details: {
        reason: safeReason,
        actionType,
        prevAutoReleaseAt,
        prevAutoReleaseAtOriginal,
        forcedReleaseAt: nowIso,
      },
    });

    revalidatePath("/admin/jobs");
    revalidatePath("/dashboard");
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true };
  }

  if (actionType === "pause_timer") {
    const { error: pauseErr } = await supabase
      .from("jobs")
      .update({
        auto_release_at: null,
        auto_release_at_original: null,
      } as never)
      .eq("id", jobId);

    if (pauseErr) {
      return { ok: false, error: pauseErr.message };
    }

    await logAdminActivity({
      adminId,
      actionType: "timer_override",
      targetType: "job",
      targetId: String(jobId),
      details: {
        reason: safeReason,
        actionType: "pause_timer",
        prevAutoReleaseAt,
        prevAutoReleaseAtOriginal,
        newAutoReleaseAt: null,
      },
    });

    revalidatePath("/admin/jobs");
    revalidatePath("/dashboard");
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true };
  }

  // Shorten/extend/cancel override: update auto_release_at timestamp only
  let newAutoReleaseAtIso: string | null = null;

  if (actionType === "cancel_override") {
    newAutoReleaseAtIso = computeBaselineIso();
  } else if (actionType === "shorten_timer") {
    const hoursLeft = typeof hours === "number" && Number.isFinite(hours) ? Math.max(0, hours) : 0;
    newAutoReleaseAtIso = new Date(
      Date.now() + hoursLeft * 60 * 60 * 1000
    ).toISOString();
  } else if (actionType === "extend_timer") {
    const additionalHours =
      typeof hours === "number" && Number.isFinite(hours) ? Math.max(0, hours) : 0;
    const additionalMs = additionalHours * 60 * 60 * 1000;
    const baseMs = computeAutoReleaseMs() ?? Date.now();
    newAutoReleaseAtIso = new Date(baseMs + additionalMs).toISOString();
  }

  if (!newAutoReleaseAtIso) {
    return { ok: false, error: "Could not compute the new auto-release time." };
  }

  const { error: updateErr } = await supabase
    .from("jobs")
    .update({ auto_release_at: newAutoReleaseAtIso } as never)
    .eq("id", jobId);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  await logAdminActivity({
    adminId,
    actionType: "timer_override",
    targetType: "job",
    targetId: String(jobId),
    details: {
      reason: safeReason,
      actionType,
      hours,
      prevAutoReleaseAt,
      prevAutoReleaseAtOriginal,
      newAutoReleaseAt: newAutoReleaseAtIso,
    },
  });

  revalidatePath("/admin/jobs");
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);

  return { ok: true };
}

