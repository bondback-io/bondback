"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe";
import { createNotification, sendPaymentReceiptEmails } from "@/lib/actions/notifications";
import { logAdminActivity } from "@/lib/admin-activity-log";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { releaseJobFunds, executeRefund } from "@/lib/actions/jobs";
import { recomputeVerificationBadgesForUser } from "@/lib/actions/verification";
import { applyReferralRewardsForCompletedJob } from "@/lib/actions/referral-rewards";

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

export async function adminForceCompleteJob(formData: FormData) {
  const jobId = formData.get("jobId");
  if (!jobId) return { ok: false, error: "Missing jobId" };
  const { supabase, adminId } = await requireAdmin();
  const { error } = await supabase
    .from("jobs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", Number(jobId));
  if (error) return { ok: false, error: error.message };
  await logAdminActivity({ adminId, actionType: "job_force_complete", targetType: "job", targetId: String(jobId), details: {} });

  return { ok: true };
}

export async function adminReinstateJob(formData: FormData) {
  const jobId = formData.get("jobId");
  if (!jobId) return { ok: false, error: "Missing jobId" };
  const { supabase, adminId } = await requireAdmin();
  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("id", Number(jobId))
    .maybeSingle();

  if (fetchError || !job) {
    return { ok: false, error: "Job not found." };
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
    return { ok: false, error: "Job cannot be reinstated from its current status." };
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ status: nextStatus } as never)
    .eq("id", Number(jobId));

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await logAdminActivity({ adminId, actionType: "job_reinstate", targetType: "job", targetId: String(jobId), details: { from: currentStatus, to: nextStatus } });

  revalidatePath("/admin/jobs");
  revalidatePath("/dashboard");
  return { ok: true };
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
    const isFullRefund = false; // Could compare amount to job total if we had agreed_amount on job
    const statusUpdate = refundStatus === "succeeded" ? "refunded" : job.status;

    const updatePayload = {
      refund_amount: amount,
      refund_status: refundStatus,
      status: statusUpdate,
      dispute_resolution: "refund",
      resolution_at: nowIso,
      resolution_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    };

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
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe refund failed.";
    return { ok: false, error: message };
  }
}

/** Legacy form-based entry point; extracts jobId and amountCents from FormData. */
export async function adminRefundJob(formData: FormData) {
  const jobId = formData.get("jobId");
  const amountCents = formData.get("amountCents");
  if (!jobId) {
    return { ok: false, error: "Missing jobId" };
  }
  const amount = amountCents ? Math.round(Number(amountCents)) : undefined;
  if (amount === undefined || amount < 1) {
    return { ok: false, error: "Missing or invalid amountCents" };
  }
  return refundJob(Number(jobId), amount);
}

export async function adminResolveDispute(formData: FormData) {
  const jobId = formData.get("jobId");
  const resolution = formData.get("resolution") as
    | "release_funds"
    | "partial_refund"
    | "full_refund"
    | "reject"
    | null;
  if (!jobId || !resolution) return { ok: false, error: "Missing data" };
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
    return { ok: false, error: fetchError?.message ?? "Job not found." };
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

  // Ensure payout/refund happens when PaymentIntent is still held (manual capture).
  if (resolution === "release_funds" || resolution === "reject") {
    const releaseResult = await releaseJobFunds(numericJobId);
    if (!releaseResult.ok) return { ok: false, error: releaseResult.error };
  }

  if (resolution === "partial_refund" || resolution === "full_refund") {
    const settings = await getGlobalSettings();
    const agreedCents = j.agreed_amount_cents ?? 0;
    const feePct =
      (settings?.platform_fee_percentage ?? settings?.fee_percentage ?? 12) / 100;
    const feeCents = Math.round(agreedCents * feePct);

    const refundTotalCents =
      resolution === "full_refund" ? agreedCents + feeCents : refundAmountCents ?? 0;

    if (!refundTotalCents || refundTotalCents < 1) {
      return { ok: false, error: "Refund amount must be provided and >= 1 cent." };
    }

    const refundResult = await executeRefund(numericJobId, refundTotalCents);
    if (!refundResult.ok) return { ok: false, error: refundResult.error };
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

  if (updateError) return { ok: false, error: updateError.message };

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
  revalidatePath(`/jobs/${numericJobId}`);

  return { ok: true };
}

export async function adminDeleteJob(formData: FormData) {
  const jobIdRaw = formData.get("jobId");
  if (!jobIdRaw) return { ok: false, error: "Missing jobId" };
  const jobId = Number(jobIdRaw);
  const { adminId } = await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Admin delete requires SUPABASE_SERVICE_ROLE_KEY so listers see updates." };
  const db = admin;

  const { data: job } = await db.from("jobs").select("id").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };

  const { error: _checklistErr } = await (db as any)
    .from("job_checklist_items")
    .delete()
    .eq("job_id", jobId);
  await db.from("job_messages").delete().eq("job_id", jobId);
  const { error } = await db.from("jobs").delete().eq("id", jobId);
  if (error) return { ok: false, error: error.message };

  await logAdminActivity({ adminId, actionType: "job_deleted", targetType: "job", targetId: String(jobId), details: {} });

  revalidatePath("/admin/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/lister/dashboard");
  revalidatePath("/my-listings");
  return { ok: true };
}

export async function adminResetAllJobs(formData: FormData) {
  const confirmed = formData.get("confirm") === "on";
  const double = formData.get("confirmText");
  if (!confirmed || (double as string)?.toLowerCase() !== "delete") {
    return { ok: false, error: "Confirmation required" };
  }
  const { supabase, adminId } = await requireAdmin();
  const { data: jobs } = await supabase.from("jobs").select("id");
  const ids = (jobs ?? []).map((j: { id: number }) => j.id);
  for (const id of ids) {
    const fd = new FormData();
    fd.set("jobId", String(id));
    // eslint-disable-next-line no-await-in-loop
    await adminDeleteJob(fd);
  }
  await logAdminActivity({ adminId, actionType: "jobs_reset_all", targetType: "job", targetId: null, details: { count: ids.length } });
  return { ok: true };
}

export type OverrideTimerActionType =
  | "force_release_now"
  | "shorten_timer"
  | "extend_timer"
  | "cancel_override";

export type OverrideTimerResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Admin override for the 48-hour review window:
 * - force_release_now: immediately capture payment + transfer to cleaner, then mark completed
 * - shorten_timer: set auto_release_at to `now + hoursLeft`
 * - extend_timer: add `hours` to current auto_release_at (or original / fallback)
 * - cancel_override: revert auto_release_at back to auto_release_at_original (or baseline)
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

  if (job.status !== "completed_pending_approval") {
    return {
      ok: false,
      error: `Job is not in completed_pending_approval (current: ${job.status}).`,
    };
  }

  if (job.payment_released_at) {
    return { ok: false, error: "Payment has already been released." };
  }

  const nowIso = new Date().toISOString();
  const prevAutoReleaseAt = job.auto_release_at ?? null;
  const prevAutoReleaseAtOriginal = job.auto_release_at_original ?? null;

  const settings = await getGlobalSettings();
  const autoReleaseHours = settings?.auto_release_hours ?? 48;
  const feePercent = (settings?.platform_fee_percentage ?? settings?.fee_percentage ?? 12) / 100;

  const computeBaselineIso = () => {
    if (job.auto_release_at_original) return job.auto_release_at_original;
    if (!job.cleaner_confirmed_at) return null;
    const baseMs =
      new Date(job.cleaner_confirmed_at).getTime() +
      autoReleaseHours * 60 * 60 * 1000;
    return new Date(baseMs).toISOString();
  };

  const computeAutoReleaseMs = () => {
    const atIso = job.auto_release_at ?? computeBaselineIso();
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

    if (job.listing_id) {
      const { error: listingErr } = await supabase
        .from("listings")
        .update({ status: "ended" } as never)
        .eq("id", job.listing_id);
      if (listingErr) {
        return { ok: false, error: listingErr.message };
      }
    }

    // Notify winner + send lister/cleaner receipts (same approach as auto-release)
    if (job.winner_id) {
      await createNotification(
        job.winner_id,
        "payment_released",
        jobId,
        "Payment was released by an admin timer override. Funds are on the way to your connected account."
      );
    }

    if (job.winner_id) await recomputeVerificationBadgesForUser(job.winner_id);
    if (job.lister_id) await recomputeVerificationBadgesForUser(job.lister_id);

    const agreedCents = job.agreed_amount_cents ?? 0;
    if (agreedCents >= 1 && job.lister_id && job.winner_id) {
      const feeCents = Math.round(agreedCents * feePercent);
      const totalCents = agreedCents + feeCents;
      let jobTitle: string | null = null;
      if (job.listing_id) {
        const { data: listing } = await supabase
          .from("listings")
          .select("title")
          .eq("id", job.listing_id)
          .maybeSingle();
        jobTitle = (listing as { title?: string } | null)?.title ?? null;
      }

      await sendPaymentReceiptEmails({
        jobId,
        listerId: job.lister_id,
        cleanerId: job.winner_id,
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

