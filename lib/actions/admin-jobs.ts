"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe";
import {
  createNotification,
  sendPaymentReceiptEmails,
  sendRefundReceiptEmail,
} from "@/lib/actions/notifications";
import { logAdminActivity } from "@/lib/admin-activity-log";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { fetchPlatformFeePercentForListing } from "@/lib/platform-fee";
import { releaseJobFunds, executeRefund } from "@/lib/actions/jobs";
import {
  escapeHtmlForEmail,
  insertDisputeThreadEntry,
  notifyAdminUsersAboutJob,
} from "@/lib/disputes/dispute-thread-and-notify";
import { getSiteUrl } from "@/lib/site";
import { recomputeVerificationBadgesForUser } from "@/lib/actions/verification";
import { applyReferralRewardsForCompletedJob } from "@/lib/actions/referral-rewards";
import { adminDeleteListingByIdCascade } from "@/lib/actions/admin-listings";
import { suggestMediationRefundCents } from "@/lib/disputes/mediation-settlement-ai";
import { insertAdminMediationProposalRecords } from "@/lib/actions/disputes";
import { isJobCancelledStatus, JOB_STATUS_NOT_IN_LISTING_SLOT } from "@/lib/jobs/job-status-helpers";
import { isCleanerStripeReleaseBlockingError } from "@/lib/stripe-payout-ready";
import { hasRecentJobNotification } from "@/lib/notifications/notification-dedupe";

type CleanerStripeNotifyReason = "dispute_resolve" | "mediation_binding" | "force_release";

/**
 * When escrow release fails because the cleaner’s Stripe Connect isn’t ready, nudge them (email + in-app)
 * so they can finish setup. Deduped per job for 24h to avoid spam if an admin retries.
 */
async function maybeNotifyCleanerStripeRequiredForRelease(
  cleanerId: string | null | undefined,
  jobId: number,
  reason: CleanerStripeNotifyReason,
  releaseError: string
): Promise<void> {
  if (!cleanerId || !releaseError) return;
  if (!isCleanerStripeReleaseBlockingError(releaseError)) return;

  const duped = await hasRecentJobNotification(cleanerId, "job_won_complete_payout", jobId, 24);
  if (duped) return;

  const lead =
    reason === "mediation_binding"
      ? `A binding mediation settlement tried to release your payout for Job #${jobId}, but your Stripe payout setup isn’t complete yet.`
      : reason === "force_release"
        ? `An admin tried to release escrow for Job #${jobId}, but your Stripe payout setup isn’t complete yet.`
        : `An admin tried to release escrow to you for Job #${jobId} (dispute settlement), but your Stripe payout setup isn’t complete yet.`;
  const msg = `${lead} Open Profile → Payments to connect your bank so we can send your funds.`;
  await createNotification(cleanerId, "job_won_complete_payout", jobId, msg, {
    persistTitle: `Finish Stripe setup · Job #${jobId}`,
    persistBody: msg,
  });
}

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
  revalidatePath("/lister/dashboard");
  revalidatePath("/my-listings");
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
  revalidatePath("/lister/dashboard");
  revalidatePath("/my-listings");
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
    revalidatePath("/lister/dashboard");
    revalidatePath("/my-listings");
    revalidatePath(`/jobs/${numericJobId}`);
    return;
  }

  // Ensure payout/refund happens when PaymentIntent is still held (manual capture).
  if (resolution === "release_funds" || resolution === "reject") {
    const releaseResult = await releaseJobFunds(numericJobId);
    if (!releaseResult.ok) {
      await maybeNotifyCleanerStripeRequiredForRelease(
        j.winner_id,
        numericJobId,
        "dispute_resolve",
        releaseResult.error
      );
      return;
    }
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
  revalidatePath("/lister/dashboard");
  revalidatePath("/my-listings");
  revalidatePath(`/jobs/${numericJobId}`);
}

/**
 * Clears dispute metadata on the job, deletes `dispute_messages` and `dispute_mediation_votes` for the job,
 * and removes it from the admin disputes queue (`disputed_at` null). Does not undo Stripe refunds/releases.
 * If the job is still in a dispute-only workflow status, moves it back to `completed_pending_approval` (when the
 * cleaner already marked complete) or `in_progress`.
 */
export async function adminPurgeJobDisputeRecord(formData: FormData): Promise<void> {
  const jobIdRaw = formData.get("jobId");
  if (!jobIdRaw) return;
  const numericJobId = Number(jobIdRaw);
  if (!Number.isFinite(numericJobId) || numericJobId < 1) return;

  const { adminId } = await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Removing a dispute record requires SUPABASE_SERVICE_ROLE_KEY on the server.");
  }

  const { data: job, error: fetchError } = await admin
    .from("jobs")
    .select("id, status, cleaner_confirmed_complete, disputed_at, payment_released_at")
    .eq("id", numericJobId)
    .maybeSingle();

  if (fetchError || !job) {
    throw new Error("Job not found.");
  }

  const row = job as {
    status: string;
    cleaner_confirmed_complete?: boolean | null;
    disputed_at?: string | null;
    payment_released_at?: string | null;
  };

  if (!row.disputed_at) {
    return;
  }

  await admin.from("dispute_messages").delete().eq("job_id", numericJobId);
  await admin.from("dispute_mediation_votes").delete().eq("job_id", numericJobId);

  let nextStatus = row.status;
  if (["disputed", "dispute_negotiating", "in_review"].includes(row.status)) {
    if (row.payment_released_at) {
      nextStatus = "completed";
    } else if (row.cleaner_confirmed_complete) {
      nextStatus = "completed_pending_approval";
    } else {
      nextStatus = "in_progress";
    }
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await admin
    .from("jobs")
    .update({
      status: nextStatus,
      updated_at: nowIso,
      disputed_at: null,
      dispute_reason: null,
      dispute_photos: null,
      dispute_evidence: null,
      dispute_opened_by: null,
      dispute_status: null,
      dispute_priority: "medium",
      dispute_escalated: false,
      dispute_mediation_status: "none",
      mediation_proposal: null,
      mediation_last_activity_at: null,
      proposed_refund_amount: null,
      counter_proposal_amount: null,
      dispute_cleaner_counter_used: false,
      dispute_lister_counter_used: false,
      admin_mediation_requested: false,
      admin_mediation_requested_at: null,
      dispute_resolution: null,
      resolution_type: null,
      resolution_at: null,
      resolution_by: null,
      dispute_response_reason: null,
      dispute_response_evidence: null,
      dispute_response_message: null,
      dispute_response_at: null,
    } as never)
    .eq("id", numericJobId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await logAdminActivity({
    adminId,
    actionType: "dispute_record_purged",
    targetType: "job",
    targetId: String(numericJobId),
    details: { previous_status: row.status, next_status: nextStatus },
  });

  revalidatePath("/admin/disputes");
  revalidatePath(`/admin/disputes/${numericJobId}`);
  revalidatePath("/disputes");
  revalidatePath("/dashboard");
  revalidatePath("/lister/dashboard");
  revalidatePath("/my-listings");
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
      await maybeNotifyCleanerStripeRequiredForRelease(
        row.winner_id,
        jobId,
        "force_release",
        releaseResult.error
      );
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

/**
 * Repair: set `winner_id` when null and the listing has exactly one `accepted` bid (same rule as
 * `sql/20260418120000_backfill_job_winner_from_accepted_bid.sql`).
 */
export async function adminBackfillJobWinnersFromAcceptedBidsForm(): Promise<void> {
  const { adminId } = await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { data: jobs, error: jErr } = await admin
    .from("jobs")
    .select("id, listing_id")
    .is("winner_id", null)
    .not("status", "in", JOB_STATUS_NOT_IN_LISTING_SLOT);

  if (jErr || !jobs?.length) {
    revalidatePath("/admin/jobs");
    return;
  }

  let updated = 0;
  for (const row of jobs) {
    const r = row as { id: number; listing_id: string };
    const { data: bids, error: bErr } = await admin
      .from("bids")
      .select("cleaner_id")
      .eq("listing_id", r.listing_id)
      .eq("status", "accepted");
    if (bErr || !bids || bids.length !== 1) continue;
    const cleanerId = (bids[0] as { cleaner_id: string }).cleaner_id;
    const { error: upErr } = await admin
      .from("jobs")
      .update({ winner_id: cleanerId, updated_at: new Date().toISOString() } as never)
      .eq("id", r.id)
      .is("winner_id", null);
    if (!upErr) updated += 1;
  }

  await logAdminActivity({
    adminId,
    actionType: "job_backfill_winner_from_bid",
    targetType: "jobs",
    targetId: "batch",
    details: { updated, scanned: jobs.length },
  });

  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  revalidatePath("/cleaner/dashboard");
}

export type MediationAiSuggestionState =
  | { ok: true; refund_cents: number; rationale: string; source: string }
  | { ok: false; error: string };

/** Admin-only: AI/heuristic refund suggestion for mediation (AUD cents from job payment to lister). */
export async function fetchMediationSettlementAiSuggestion(
  jobId: number
): Promise<MediationAiSuggestionState> {
  try {
    const { supabase } = await requireAdmin();
    if (!Number.isFinite(jobId) || jobId < 1) {
      return { ok: false, error: "Invalid job." };
    }
    const { data: job, error } = await supabase
      .from("jobs")
      .select("agreed_amount_cents, proposed_refund_amount, counter_proposal_amount, dispute_reason")
      .eq("id", jobId)
      .maybeSingle();
    if (error || !job) return { ok: false, error: "Job not found." };
    const j = job as {
      agreed_amount_cents?: number | null;
      proposed_refund_amount?: number | null;
      counter_proposal_amount?: number | null;
      dispute_reason?: string | null;
    };
    const suggestion = await suggestMediationRefundCents({
      agreedAmountCents: Math.max(0, Number(j.agreed_amount_cents ?? 0)),
      proposedRefundCents:
        j.proposed_refund_amount != null ? Number(j.proposed_refund_amount) : null,
      counterRefundCents:
        j.counter_proposal_amount != null ? Number(j.counter_proposal_amount) : null,
      disputeReason: j.dispute_reason ?? null,
    });
    return {
      ok: true,
      refund_cents: suggestion.refund_cents,
      rationale: suggestion.rationale,
      source: suggestion.source,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Not authorized.";
    return { ok: false, error: msg };
  }
}

export type AdminMediationSettlementState =
  | { ok: true; success: string }
  | { ok: false; error: string };

/**
 * Admin mediation: either send a proposal for both parties to accept (with optional lister top-up),
 * or impose a binding settlement (refund + release to cleaner) when top-up is zero.
 */
export async function adminSubmitMediationSettlement(
  _prev: AdminMediationSettlementState | undefined,
  formData: FormData
): Promise<AdminMediationSettlementState> {
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  let adminId: string;
  try {
    const r = await requireAdmin();
    supabase = r.supabase;
    adminId = r.adminId;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }

  const jobId = Number(formData.get("jobId"));
  const proposalText = String(formData.get("proposalText") ?? "").trim();
  const mode = String(formData.get("settlementMode") ?? "collaborative").toLowerCase();
  const refundCents = Math.max(0, Math.round(Number(formData.get("refundCents") ?? 0)));
  const topUpCents = Math.max(0, Math.round(Number(formData.get("additionalPaymentCents") ?? 0)));

  if (!Number.isFinite(jobId) || jobId < 1) {
    return { ok: false, error: "Invalid job." };
  }
  if (!proposalText) {
    return { ok: false, error: "Settlement notes are required." };
  }

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select(
      "id, lister_id, winner_id, listing_id, status, agreed_amount_cents, payment_released_at, payment_intent_id"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (fetchError || !job) return { ok: false, error: "Job not found." };

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

  const st = String(j.status ?? "").toLowerCase();
  if (st === "completed" || isJobCancelledStatus(st)) {
    return { ok: false, error: "This job is already completed or cancelled." };
  }

  const agreed = Math.max(0, Number(j.agreed_amount_cents ?? 0));
  /** Job total in escrow to cleaners (initial bid + lister top-ups). Platform fee is not refundable via this field. */
  const maxRefundCents = agreed;

  if (refundCents > maxRefundCents) {
    return {
      ok: false,
      error: `Refund cannot exceed the job amount held in escrow ($${(maxRefundCents / 100).toFixed(2)} AUD including top-ups). The Service Fee is not refundable here — use “Close / resolve dispute” → Full refund if the entire card charge must be reversed.`,
    };
  }

  if (mode === "final_override") {
    if (topUpCents > 0) {
      return {
        ok: false,
        error:
          "You cannot impose a cleaner top-up without the lister paying. Clear top-up to $0 for a binding refund + release, or use “Send for acceptance” so both parties agree first.",
      };
    }
    if (!["disputed", "in_review", "dispute_negotiating"].includes(st)) {
      return {
        ok: false,
        error: "Binding settlement is only available for active dispute statuses (disputed, in review, or negotiating).",
      };
    }
    if (j.payment_released_at) {
      return { ok: false, error: "Escrow was already released; do not run binding settlement." };
    }

    const nowIso = new Date().toISOString();

    if (refundCents >= 1) {
      const refundResult = await executeRefund(jobId, refundCents);
      if (!refundResult.ok) {
        return { ok: false, error: refundResult.error ?? "Stripe refund failed." };
      }
    }

    const releaseResult = await releaseJobFunds(jobId);
    if (!releaseResult.ok) {
      const err =
        releaseResult.error ??
        "Could not release remaining funds to the cleaner after refund. Check Stripe Connect and job escrow state.";
      await maybeNotifyCleanerStripeRequiredForRelease(j.winner_id, jobId, "mediation_binding", err);
      return {
        ok: false,
        error: err,
      };
    }

    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "completed",
        completed_at: nowIso,
        dispute_mediation_status: "accepted",
        mediation_proposal: proposalText,
        mediation_last_activity_at: nowIso,
        dispute_resolution: "admin_mediation_final",
        resolution_type: "mediation",
        resolution_at: nowIso,
        resolution_by: adminId,
        dispute_status: "completed",
        proposed_refund_amount: refundCents,
        counter_proposal_amount: null,
        refund_amount: refundCents >= 1 ? refundCents : null,
      } as never)
      .eq("id", jobId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    if (j.listing_id) {
      await supabase.from("listings").update({ status: "ended" } as never).eq("id", j.listing_id);
    }

    await insertDisputeThreadEntry({
      jobId,
      authorUserId: adminId,
      authorRole: "admin",
      body: `Binding admin mediation settlement applied.\n\n${proposalText}\n\nRefund to lister: $${(refundCents / 100).toFixed(2)} AUD · Remaining escrow released to cleaner.`,
      visibility: { lister: true, cleaner: true },
    });

    const msg =
      refundCents >= 1
        ? `Admin resolved the dispute: $${(refundCents / 100).toFixed(2)} refunded to you; remaining payment released to the cleaner.`
        : "Admin resolved the dispute: full job payment released to the cleaner (no refund).";
    if (j.lister_id) await createNotification(j.lister_id, "dispute_resolved", jobId, msg);
    if (j.winner_id) {
      await createNotification(
        j.winner_id,
        "dispute_resolved",
        jobId,
        refundCents >= 1
          ? `Admin resolved the dispute: lister refund $${(refundCents / 100).toFixed(2)}; your payout has been released.`
          : "Admin resolved the dispute: your payout has been released."
      );
    }

    if (refundCents >= 1 && j.lister_id) {
      let jobTitle: string | null = null;
      if (j.listing_id) {
        const { data: listing } = await supabase
          .from("listings")
          .select("title")
          .eq("id", j.listing_id)
          .maybeSingle();
        jobTitle = (listing as { title?: string } | null)?.title ?? null;
      }
      await sendRefundReceiptEmail({
        jobId,
        listerId: j.lister_id,
        refundCents,
        jobTitle,
        dateIso: nowIso,
      });
    }

    if (j.winner_id) await recomputeVerificationBadgesForUser(j.winner_id);
    if (j.lister_id) await recomputeVerificationBadgesForUser(j.lister_id);
    try {
      await applyReferralRewardsForCompletedJob(jobId);
    } catch {
      // non-fatal
    }

    const adminConsoleUrl = `${getSiteUrl().origin}/admin/disputes/${jobId}`;
    await notifyAdminUsersAboutJob({
      jobId,
      subject: `[Bond Back] Job #${jobId}: binding mediation settlement applied`,
      htmlBody: `<p>An admin applied a <strong>binding mediation settlement</strong> for job #${jobId}.</p><p>Refund to lister: $${(refundCents / 100).toFixed(2)} AUD · Remaining escrow released to the cleaner · job completed.</p><p style="white-space:pre-wrap;">${escapeHtmlForEmail(proposalText)}</p><p><a href="${adminConsoleUrl}">Admin dispute record</a></p>`,
      inAppMessage: `Job #${jobId}: binding mediation settlement applied — dispute closed.`,
    });

    await logAdminActivity({
      adminId,
      actionType: "dispute_resolved",
      targetType: "job",
      targetId: String(jobId),
      details: { resolution: "admin_mediation_final", refundCents },
    });

    revalidatePath("/admin/disputes");
    revalidatePath("/disputes");
    revalidatePath("/dashboard");
    revalidatePath("/lister/dashboard");
    revalidatePath("/my-listings");
    revalidatePath("/cleaner/dashboard");
    revalidatePath("/earnings");
    revalidatePath(`/jobs/${jobId}`);
    return {
      ok: true,
      success: "Binding settlement applied: refund (if any) processed and remaining escrow released to the cleaner.",
    };
  }

  if (!["disputed", "in_review", "dispute_negotiating"].includes(st)) {
    return {
      ok: false,
      error: "Send a proposal only when the job is in disputed, in review, or negotiating.",
    };
  }

  try {
    await insertAdminMediationProposalRecords({
      jobId,
      adminUserId: adminId,
      proposalText,
      refundCents,
      additionalPaymentCents: topUpCents,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save mediation proposal.";
    return { ok: false, error: msg };
  }

  await logAdminActivity({
    adminId,
    actionType: "dispute_mediation_proposed",
    targetType: "job",
    targetId: String(jobId),
    details: { refundCents, topUpCents, collaborative: true },
  });

  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  revalidatePath("/lister/dashboard");
  revalidatePath("/cleaner/dashboard");

  const topHint =
    topUpCents > 0
      ? ` Lister top-up $${(topUpCents / 100).toFixed(2)} requires their approval via checkout once both accept.`
      : "";
  return {
    ok: true,
    success: `Mediation proposal sent to both parties.${topHint}`,
  };
}

