"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, getEmailForUserId } from "@/lib/supabase/admin";
import { createNotification, sendRefundReceiptEmail } from "@/lib/actions/notifications";
import {
  createJobTopUpCheckoutSession,
  executeRefund,
  openDispute,
  releaseJobFunds,
} from "@/lib/actions/jobs";
import { recomputeVerificationBadgesForUser } from "@/lib/actions/verification";
import { applyReferralRewardsForCompletedJob } from "@/lib/actions/referral-rewards";
import { isCleanerStripeReleaseBlockingError } from "@/lib/stripe-payout-ready";
import { hasRecentJobNotification } from "@/lib/notifications/notification-dedupe";
import { sendEmail } from "@/lib/notifications/email";
import { getSiteUrl } from "@/lib/site";
import { countJobAfterPhotosFromStorage } from "@/lib/jobs/after-photo-storage-count";
import {
  disputeHubLinksHtml,
  escapeHtmlForEmail,
  insertDisputeThreadEntry,
  notifyAdminUsersAboutJob,
  sendDisputeActivityEmail,
} from "@/lib/disputes/dispute-thread-and-notify";

function trimText(v: unknown): string {
  return String(v ?? "").trim();
}

function toCents(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

/** Form sends whole or decimal AUD dollars (e.g. 80 or 80.5); stored as integer cents. */
function audDollarsInputToCents(v: unknown): number {
  const raw = String(v ?? "").trim().replace(/,/g, "");
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

async function maybeNotifyCleanerCollaborativeMediationReleaseFailed(
  cleanerId: string | null | undefined,
  jobId: number,
  releaseError: string
): Promise<void> {
  if (!cleanerId || !releaseError) return;
  if (!isCleanerStripeReleaseBlockingError(releaseError)) return;
  const duped = await hasRecentJobNotification(cleanerId, "job_won_complete_payout", jobId, 24);
  if (duped) return;
  const msg = `You and the lister accepted mediation for Job #${jobId}, but escrow could not be released because your Stripe payout setup is not complete. Open Profile → Payments to connect your bank.`;
  await createNotification(cleanerId, "job_won_complete_payout", jobId, msg, {
    persistTitle: `Finish Stripe setup · Job #${jobId}`,
    persistBody: msg,
  });
}

async function requireSession() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = trimText(session?.user?.id);
  if (!userId) return null;
  return { supabase, userId };
}

/** Returned to client components (useActionState / useTransition). Never throw for user-facing flows. */
export type DisputeActionState = {
  ok?: boolean;
  error?: string;
  success?: string;
  /** Lister accepted cleaner payment request — open Stripe Checkout */
  checkoutUrl?: string;
  /** Mediation accept/decline — drives dispute hub UI messaging */
  mediationVoteOutcome?:
    | "pending_other_party"
    | "completed"
    | "lister_checkout_redirect"
    | "cleaner_waiting_lister_topup"
    | "already_finalized"
    | "declined";
};

async function requireUserOrError(): Promise<
  | { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; userId: string }
  | { error: string }
> {
  const s = await requireSession();
  if (!s) return { error: "You must be signed in." };
  return s;
}

/** @deprecated internal — admin propose mediation form */
async function requireUser() {
  const s = await requireSession();
  if (!s) throw new Error("Not authenticated");
  return s;
}

export async function submitCleanerAdditionalPaymentRequest(
  _prev: DisputeActionState | undefined,
  formData: FormData
): Promise<DisputeActionState> {
  const auth = await requireUserOrError();
  if ("error" in auth) return { error: auth.error };

  try {
    const { supabase, userId } = auth;
    const jobId = Number(formData.get("jobId"));
    const amountCents =
      audDollarsInputToCents(formData.get("amountAud")) ||
      toCents(formData.get("amountCents"));
    const reason = trimText(formData.get("reason"));
    const attachmentLines = String(formData.get("attachmentUrls") ?? "")
      .split(/[\n\r]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (!jobId || amountCents < 100 || !reason) {
      return { error: "Enter at least $1.00 AUD and a reason." };
    }
    if (attachmentLines.length < 1) {
      return { error: "Upload at least one supporting image (or paste image URLs)." };
    }

    const { data: job } = await supabase
      .from("jobs")
      .select("id, winner_id, lister_id, status, listing_id")
      .eq("id", jobId)
      .maybeSingle();
    const row = job as {
      winner_id?: string | null;
      lister_id?: string | null;
      status?: string;
      listing_id?: string | null;
    } | null;
    if (!row || row.winner_id !== userId) {
      return { error: "Only the assigned cleaner can request this." };
    }
    if (
      !["in_progress", "completed_pending_approval", "disputed", "dispute_negotiating"].includes(
        String(row.status ?? "")
      )
    ) {
      return { error: "This job is not eligible for an additional payment request." };
    }

    const afterCount = await countJobAfterPhotosFromStorage(jobId);
    if (afterCount < 3) {
      return {
        error: "Upload at least 3 after-photos on the job (stage 4) before requesting additional payment.",
      };
    }

    const admin = createSupabaseAdminClient();
    if (!admin) return { error: "Server configuration error. Try again later." };

    await (admin as any).from("cleaner_additional_payment_requests").insert({
      job_id: jobId,
      cleaner_id: userId,
      lister_id: row.lister_id,
      amount_cents: amountCents,
      reason,
      status: "pending",
    });

    const threadBody = [
      "Additional payment request (cleaner)",
      `Amount: $${(amountCents / 100).toFixed(2)} AUD`,
      "",
      "Reason:",
      reason,
      "",
      "The lister can Accept or Deny this request from the job or listing page.",
    ].join("\n");
    await (admin as any).from("dispute_messages").insert({
      job_id: jobId,
      author_user_id: userId,
      author_role: "user",
      body: threadBody,
      attachment_urls: attachmentLines,
      is_escalation_event: false,
      visible_to_lister: true,
      visible_to_cleaner: true,
    });

    if (row.lister_id) {
      await createNotification(
        row.lister_id,
        "job_status_update",
        jobId,
        `Cleaner requested additional payment of $${(amountCents / 100).toFixed(2)}.`
      );
      const listerEmail = await getEmailForUserId(row.lister_id);
      if (trimText(listerEmail)) {
        const lid = trimText(row.listing_id);
        const listingUrl = lid
          ? `${getSiteUrl().origin}/listings/${encodeURIComponent(lid)}`
          : "";
        const jobUrl = `${getSiteUrl().origin}/jobs/${jobId}`;
        await sendEmail(
          trimText(listerEmail),
          `[BB-DISPUTE-${jobId}] Additional Payment Requested`,
          `<p>Your cleaner requested an additional payment for Job #${jobId}.</p><p><strong>Amount:</strong> $${(amountCents / 100).toFixed(2)} AUD</p><p><strong>Reason:</strong> ${reason.replace(/</g, "&lt;")}</p><p><a href="${jobUrl}">Open the job</a> and tap <strong>View request</strong> to accept or deny. A thread entry was added under Dispute Resolution.</p>${
            listingUrl
              ? `<p>Or <a href="${listingUrl}">open your listing</a> to respond.</p>`
              : ""
          }`
        );
      }
    }

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/disputes");
    const lid = trimText(row?.listing_id);
    if (lid) revalidatePath(`/listings/${lid}`);
    return { ok: true, success: "Request sent to the lister. They’ll be notified by email and in-app." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { error: msg };
  }
}

export async function reviewCleanerAdditionalPaymentRequest(formData: FormData): Promise<DisputeActionState> {
  const auth = await requireUserOrError();
  if ("error" in auth) return { error: auth.error };

  try {
    const { userId } = auth;
    const requestId = trimText(formData.get("requestId"));
    const decision = trimText(formData.get("decision"));
    const listerNoteRaw = trimText(formData.get("listerNote"));
    const listerNote = listerNoteRaw.slice(0, 2000);
    if (!requestId || !["accept", "deny"].includes(decision)) {
      return { error: "Invalid request." };
    }

    const admin = createSupabaseAdminClient();
    if (!admin) return { error: "Server configuration error. Try again later." };

    const { data } = await (admin as any)
      .from("cleaner_additional_payment_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    const req = data as any;
    if (!req || req.lister_id !== userId) return { error: "Only the lister can review this request." };
    if (req.status !== "pending") return { error: "This request was already reviewed." };

    const { data: jobLoc } = await (admin as any)
      .from("jobs")
      .select("listing_id")
      .eq("id", req.job_id)
      .maybeSingle();
    const listingUuid = trimText((jobLoc as { listing_id?: string } | null)?.listing_id);

    const revalidateJobAndListing = () => {
      revalidatePath(`/jobs/${req.job_id}`);
      revalidatePath("/disputes");
      if (listingUuid) revalidatePath(`/listings/${listingUuid}`);
    };

    if (decision === "deny") {
      await (admin as any)
        .from("cleaner_additional_payment_requests")
        .update({
          status: "denied",
          responded_by: userId,
          responded_at: new Date().toISOString(),
          lister_response_note: listerNote || null,
        })
        .eq("id", requestId);
      const inAppMsg = listerNote
        ? `Lister denied your additional payment request. Note: ${listerNote.slice(0, 500)}`
        : "Lister denied your additional payment request.";
      await createNotification(req.cleaner_id, "job_status_update", req.job_id, inAppMsg);
      const denyBody = [
        "Additional payment request — DENIED (lister)",
        `Amount was: $${(Number(req.amount_cents) / 100).toFixed(2)} AUD`,
        listerNote ? `\nLister note:\n${listerNote}` : "",
      ].join("\n");
      await insertDisputeThreadEntry({
        jobId: Number(req.job_id),
        authorUserId: userId,
        authorRole: "lister",
        body: denyBody,
      });
      const cleanerEmail = await getEmailForUserId(req.cleaner_id);
      if (trimText(cleanerEmail)) {
        const safeNote = listerNote.replace(/</g, "&lt;");
        await sendEmail(
          trimText(cleanerEmail),
          `[BB-JOB-${req.job_id}] Additional payment request declined`,
          `<p>The lister declined your additional payment request for Job #${req.job_id}.</p>${
            safeNote
              ? `<p><strong>Lister note:</strong> ${safeNote}</p>`
              : ""
          }`
        );
      }
      revalidateJobAndListing();
      return { ok: true, success: "Request denied. The cleaner has been notified." };
    }

    const reasonLine = String(req.reason ?? "").trim().slice(0, 180);
    const topUpNote =
      reasonLine.length > 0
        ? `Additional payment (cleaner request): ${reasonLine}`
        : "Additional payment (cleaner request)";
    const topUp = await createJobTopUpCheckoutSession(
      Number(req.job_id),
      Number(req.amount_cents),
      topUpNote,
      { flexibleCleanerRequest: true }
    );
    if (!topUp.ok) return { error: topUp.error ?? "Could not create Stripe checkout." };

    await (admin as any)
      .from("cleaner_additional_payment_requests")
      .update({
        status: "accepted",
        responded_by: userId,
        responded_at: new Date().toISOString(),
        accepted_checkout_session_id: null,
      })
      .eq("id", requestId);

    await createNotification(
      req.cleaner_id,
      "job_status_update",
      req.job_id,
      `Lister accepted your additional payment request ($${(Number(req.amount_cents) / 100).toFixed(2)}). They will complete payment in Stripe; you will be notified when funds are held.`
    );
    const cleanerEmailAccept = await getEmailForUserId(req.cleaner_id);
    if (trimText(cleanerEmailAccept)) {
      const amt = (Number(req.amount_cents) / 100).toFixed(2);
      const safeReason = String(req.reason ?? "")
        .trim()
        .replace(/</g, "&lt;")
        .slice(0, 1500);
      await sendEmail(
        trimText(cleanerEmailAccept),
        `[BB-JOB-${req.job_id}] Additional payment accepted — lister paying`,
        `<p>The lister accepted your additional payment request for Job #${req.job_id}.</p><p><strong>Amount:</strong> $${amt} AUD</p>${
          safeReason ? `<p><strong>Your reason:</strong> ${safeReason}</p>` : ""
        }<p>They are opening Stripe Checkout to add this amount to escrow. You will get another update when the payment is held.</p>`
      );
    }
    revalidateJobAndListing();
    return {
      ok: true,
      success: "Opening Stripe to complete the extra escrow payment…",
      checkoutUrl: topUp.url,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { error: msg };
  }
}

export async function submitDisputeMessage(
  _prev: DisputeActionState | undefined,
  formData: FormData
): Promise<DisputeActionState> {
  const auth = await requireUserOrError();
  if ("error" in auth) return { error: auth.error };

  try {
    const { supabase, userId } = auth;
    const jobId = Number(formData.get("jobId"));
    const body = trimText(formData.get("body"));
    const escalate = trimText(formData.get("escalate")) === "1";
    const attachmentUrls = String(formData.get("attachmentUrls") ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (!jobId || body.length < 2) return { error: "Message is too short." };

    const { data: job } = await supabase
      .from("jobs")
      .select("id, lister_id, winner_id, status")
      .eq("id", jobId)
      .maybeSingle();
    const j = job as { lister_id?: string | null; winner_id?: string | null; status?: string } | null;
    if (!j) return { error: "Job not found." };
    const isParty = userId === j.lister_id || userId === j.winner_id;
    if (!isParty) return { error: "Not authorized." };

    const admin = createSupabaseAdminClient();
    if (!admin) return { error: "Server configuration error. Try again later." };

    await (admin as any).from("dispute_messages").insert({
      job_id: jobId,
      author_user_id: userId,
      author_role: "user",
      body,
      attachment_urls: attachmentUrls,
      is_escalation_event: escalate,
      visible_to_lister: true,
      visible_to_cleaner: true,
    });

    if (escalate) {
      await (admin as any)
        .from("jobs")
        .update({
          dispute_escalated: true,
          dispute_mediation_status: "requested",
          dispute_status: "in_review",
          status: "in_review",
          mediation_last_activity_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    const otherUserId = userId === j.lister_id ? j.winner_id : j.lister_id;
    if (otherUserId) {
      await createNotification(
        otherUserId,
        "dispute_opened",
        jobId,
        escalate ? "Dispute escalated for admin mediation." : "New dispute message received."
      );
      await sendDisputeActivityEmail({
        jobId,
        toUserId: otherUserId,
        subject: escalate
          ? `[Bond Back] Job #${jobId}: dispute escalated`
          : `[Bond Back] New dispute message — job #${jobId}`,
        htmlBody: `<p>${escalate ? "A dispute was <strong>escalated</strong> for admin mediation." : "You have a new message"} on job #${jobId}.</p><p style="white-space:pre-wrap;">${escapeHtmlForEmail(body)}</p>${disputeHubLinksHtml(jobId)}`,
      });
    }
    if (escalate) {
      const { data: admins } = await (admin as any).from("profiles").select("id").eq("is_admin", true);
      for (const a of admins ?? []) {
        if (a?.id) await createNotification(a.id, "dispute_opened", jobId, `Dispute #${jobId} was escalated for mediation.`);
      }
    }
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/disputes");
    revalidatePath("/admin/disputes");
    return { ok: true, success: escalate ? "Message sent and mediation requested." : "Message posted to the dispute thread." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { error: msg };
  }
}

export type InsertAdminMediationProposalParams = {
  jobId: number;
  adminUserId: string;
  proposalText: string;
  refundCents: number;
  additionalPaymentCents: number;
};

/**
 * Record a mediation package and notify parties (both must accept unless a party declines — then admin applies a binding final settlement, or admin sends a new proposal).
 */
export async function insertAdminMediationProposalRecords(
  params: InsertAdminMediationProposalParams
): Promise<void> {
  const { jobId, adminUserId, proposalText, refundCents, additionalPaymentCents } = params;
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Missing admin client.");

  await (admin as any).from("dispute_mediation_votes").insert({
    job_id: jobId,
    proposal_text: proposalText,
    refund_cents: refundCents,
    additional_payment_cents: additionalPaymentCents,
    created_by: adminUserId,
    lister_accepted: null,
    cleaner_accepted: null,
  });
  await (admin as any)
    .from("jobs")
    .update({
      dispute_mediation_status: "proposed",
      mediation_proposal: proposalText,
      mediation_last_activity_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  await (admin as any).from("dispute_messages").insert({
    job_id: jobId,
    author_user_id: adminUserId,
    author_role: "admin",
    body: `Mediation proposal\n\n${proposalText}\n\nRefund (cents): ${refundCents} · Top-up (cents): ${additionalPaymentCents}`,
    attachment_urls: [],
    is_escalation_event: false,
    visible_to_lister: true,
    visible_to_cleaner: true,
  });

  const { data: jobRow } = await (admin as any)
    .from("jobs")
    .select("lister_id, winner_id")
    .eq("id", jobId)
    .maybeSingle();
  const jr = jobRow as { lister_id?: string; winner_id?: string | null } | null;
  const parties = [jr?.lister_id, jr?.winner_id].filter(Boolean) as string[];
  const snippet = proposalText.length > 200 ? `${proposalText.slice(0, 197)}…` : proposalText;
  for (const pid of parties) {
    await createNotification(
      pid,
      "dispute_opened",
      jobId,
      `Admin posted a mediation proposal: ${snippet}`
    );
    await sendDisputeActivityEmail({
      jobId,
      toUserId: pid,
      subject: `[Bond Back] Job #${jobId}: mediation proposal from admin`,
      htmlBody: `<p>An admin posted a <strong>mediation proposal</strong> for job #${jobId}.</p><p style="white-space:pre-wrap;">${escapeHtmlForEmail(proposalText)}</p><p>Refund: $${(refundCents / 100).toFixed(2)} · Top-up: $${(additionalPaymentCents / 100).toFixed(2)}</p>${disputeHubLinksHtml(jobId)}`,
    });
  }
}

export async function proposeMediation(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const jobId = Number(formData.get("jobId"));
  const proposalText = trimText(formData.get("proposalText"));
  const refundCents = toCents(formData.get("refundCents"));
  const additionalPaymentCents = toCents(formData.get("additionalPaymentCents"));
  if (!jobId || !proposalText) throw new Error("Missing proposal.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!(profile as any)?.is_admin) throw new Error("Not authorized.");

  await insertAdminMediationProposalRecords({
    jobId,
    adminUserId: userId,
    proposalText,
    refundCents,
    additionalPaymentCents,
  });

  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");
}

export async function respondToMediationProposal(formData: FormData): Promise<DisputeActionState> {
  const auth = await requireUserOrError();
  if ("error" in auth) return { error: auth.error };

  try {
    const { supabase, userId } = auth;
    const jobId = Number(formData.get("jobId"));
    const vote = trimText(formData.get("vote")) === "accept";
    if (!jobId) return { error: "Missing job." };

    const { data: job } = await supabase
      .from("jobs")
      .select("id, lister_id, winner_id, listing_id, dispute_mediation_status")
      .eq("id", jobId)
      .maybeSingle();
    const j = job as {
      lister_id?: string;
      winner_id?: string | null;
      listing_id?: string | null;
      dispute_mediation_status?: string | null;
    } | null;
    if (!j) return { error: "Job not found." };
    const isLister = userId === j.lister_id;
    const isCleaner = userId === j.winner_id;
    if (!isLister && !isCleaner) return { error: "Not authorized." };

    const admin = createSupabaseAdminClient();
    if (!admin) return { error: "Server configuration error. Try again later." };

    const mediationStatus = String(j.dispute_mediation_status ?? "none");
    if (mediationStatus !== "proposed") {
      return {
        error:
          mediationStatus === "awaiting_admin_final"
            ? "A mediation proposal was declined. An admin will issue a final decision — you do not need to respond again."
            : "There is no active mediation proposal to respond to.",
      };
    }

    const { data: latest } = await (admin as any)
      .from("dispute_mediation_votes")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) return { error: "No proposal found." };

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (isLister) patch.lister_accepted = vote;
    if (isCleaner) patch.cleaner_accepted = vote;

    const { data: updated } = await (admin as any)
      .from("dispute_mediation_votes")
      .update(patch)
      .eq("id", latest.id)
      .select("*")
      .maybeSingle();
    const u = updated as any;
    if (!u) return { error: "Could not update vote." };

    if (u.lister_accepted === true && u.cleaner_accepted === true) {
      const additionalCents = Number(u.additional_payment_cents ?? 0);
      const refundCents = Number(u.refund_cents ?? 0);

      const { data: jobMediationState } = await (admin as any)
        .from("jobs")
        .select("dispute_mediation_status, resolution_type")
        .eq("id", jobId)
        .maybeSingle();
      const jms = jobMediationState as {
        dispute_mediation_status?: string | null;
        resolution_type?: string | null;
      } | null;
      if (
        jms?.dispute_mediation_status === "accepted" &&
        jms?.resolution_type === "mediation"
      ) {
        return {
          ok: true,
          success: "This mediation was already finalized.",
          mediationVoteOutcome: "already_finalized",
        };
      }

      if (refundCents >= 1) {
        const { data: refundState } = await (admin as any)
          .from("jobs")
          .select("refund_amount")
          .eq("id", jobId)
          .maybeSingle();
        const prevRefund = Number((refundState as { refund_amount?: number | null } | null)?.refund_amount ?? 0);
        if (prevRefund < refundCents) {
          const refundResult = await executeRefund(jobId, refundCents);
          if (!refundResult.ok) {
            return {
              error:
                refundResult.error ??
                "Stripe refund failed. Mediation was not finalized — fix payment state or adjust the refund amount.",
            };
          }
          await insertDisputeThreadEntry({
            jobId,
            authorUserId: null,
            authorRole: "system",
            body: `Mediation: $${(refundCents / 100).toFixed(2)} AUD refunded to the lister via Stripe (per admin proposal).`,
          });
        }
        await (admin as any)
          .from("jobs")
          .update({
            refund_amount: refundCents,
            proposed_refund_amount: refundCents,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", jobId);
      }

      const mediationJobPatch = {
        proposed_refund_amount: refundCents,
        counter_proposal_amount: null,
        ...(refundCents >= 1 ? { refund_amount: refundCents } : {}),
      };

      /**
       * Top-up checkout requires job status `in_progress` or `completed_pending_approval` and a
       * logged-in lister. Do not set `status: completed` before top-up — that blocks checkout.
       */
      if (additionalCents > 0) {
        await insertDisputeThreadEntry({
          jobId,
          authorUserId: null,
          authorRole: "system",
          body: "Mediation proposal accepted by both parties. The lister must pay the approved additional amount to continue; the job stays open until that payment completes.",
        });
        await (admin as any)
          .from("jobs")
          .update({
            dispute_mediation_status: "accepted",
            status: "completed_pending_approval",
            dispute_status: "completed",
            dispute_resolution: "mediation",
            resolution_type: "mediation",
            resolution_at: new Date().toISOString(),
            ...mediationJobPatch,
          })
          .eq("id", jobId);

        if (isLister) {
          const topUp = await createJobTopUpCheckoutSession(
            jobId,
            additionalCents,
            "Mediation-approved additional payment",
            { flexibleCleanerRequest: true }
          );
          if (!topUp.ok) {
            return { error: topUp.error ?? "Mediation saved but could not start payment. Open the job and try Pay / top-up, or contact support." };
          }
          revalidatePath(`/jobs/${jobId}`);
          revalidatePath("/disputes");
          revalidatePath("/admin/disputes");
          revalidatePath("/my-listings");
          revalidatePath("/lister/dashboard");
          return {
            ok: true,
            success: "Redirecting to pay the mediation top-up…",
            checkoutUrl: topUp.url,
            mediationVoteOutcome: "lister_checkout_redirect",
          };
        }

        const listerId = trimText(j.lister_id);
        if (listerId) {
          await createNotification(
            listerId,
            "job_status_update",
            jobId,
            `Mediation was accepted. Pay the additional $${(additionalCents / 100).toFixed(2)} from the job page (top-up) to finalize.`
          );
          await sendDisputeActivityEmail({
            jobId,
            toUserId: listerId,
            subject: `[Bond Back] Job #${jobId}: pay mediation top-up`,
            htmlBody: `<p>Both parties accepted the mediation proposal. Please open the job and complete the <strong>additional payment</strong> ($${(
              additionalCents / 100
            ).toFixed(2)} AUD) to continue.</p>${disputeHubLinksHtml(jobId)}`,
          });
        }
        revalidatePath(`/jobs/${jobId}`);
        revalidatePath("/disputes");
        revalidatePath("/admin/disputes");
        revalidatePath(`/admin/disputes/${jobId}`);
        return {
          ok: true,
          success:
            "Mediation accepted. The lister has been asked to pay the additional amount from the job page.",
          mediationVoteOutcome: "cleaner_waiting_lister_topup",
        };
      }

      const nowIso = new Date().toISOString();
      const releaseResult = await releaseJobFunds(jobId, { supabase: admin });
      if (!releaseResult.ok) {
        await maybeNotifyCleanerCollaborativeMediationReleaseFailed(
          j.winner_id,
          jobId,
          releaseResult.error ?? ""
        );
        return {
          error:
            releaseResult.error ??
            "Escrow could not be released to the cleaner. Mediation was not finalized — check Stripe and Connect setup.",
        };
      }

      const refundPart =
        refundCents >= 1
          ? `$${(refundCents / 100).toFixed(2)} AUD was refunded to the lister (per the mediation proposal). `
          : "";
      await insertDisputeThreadEntry({
        jobId,
        authorUserId: null,
        authorRole: "system",
        body: `Mediation proposal accepted by both parties. ${refundPart}Remaining escrow has been released to the cleaner. The job is complete and the dispute is closed.`,
      });

      await (admin as any)
        .from("jobs")
        .update({
          dispute_mediation_status: "accepted",
          status: "completed",
          completed_at: nowIso,
          dispute_status: "completed",
          dispute_resolution: "mediation",
          resolution_type: "mediation",
          resolution_at: nowIso,
          ...mediationJobPatch,
        })
        .eq("id", jobId);

      const listingId = trimText(j.listing_id);
      if (listingId) {
        await (admin as any).from("listings").update({ status: "ended" } as never).eq("id", listingId);
      }

      const listerId = trimText(j.lister_id);
      const winnerId = trimText(j.winner_id);
      const listerMsg =
        refundCents >= 1
          ? `You and the cleaner accepted the mediation proposal. $${(refundCents / 100).toFixed(2)} has been refunded to you; the remaining payment was released to the cleaner. The dispute is closed.`
          : `You and the cleaner accepted the mediation proposal. Payment was released to the cleaner. The dispute is closed.`;
      const cleanerMsg =
        refundCents >= 1
          ? `You and the lister accepted the mediation proposal. A partial refund was issued to the lister; your payout for the remaining balance has been released. The dispute is closed.`
          : `You and the lister accepted the mediation proposal. Your payout has been released. The dispute is closed.`;

      if (listerId) {
        await createNotification(listerId, "dispute_resolved", jobId, listerMsg);
        await sendDisputeActivityEmail({
          jobId,
          toUserId: listerId,
          subject: `[Bond Back] Job #${jobId}: dispute closed — mediation accepted`,
          htmlBody: `<p>${escapeHtmlForEmail(listerMsg)}</p>${disputeHubLinksHtml(jobId)}`,
        });
      }
      if (winnerId) {
        await createNotification(winnerId, "dispute_resolved", jobId, cleanerMsg);
        await sendDisputeActivityEmail({
          jobId,
          toUserId: winnerId,
          subject: `[Bond Back] Job #${jobId}: dispute closed — payout released`,
          htmlBody: `<p>${escapeHtmlForEmail(cleanerMsg)}</p>${disputeHubLinksHtml(jobId)}`,
        });
      }

      if (refundCents >= 1 && listerId) {
        let jobTitle: string | null = null;
        if (listingId) {
          const { data: listing } = await (admin as any)
            .from("listings")
            .select("title")
            .eq("id", listingId)
            .maybeSingle();
          jobTitle = (listing as { title?: string } | null)?.title ?? null;
        }
        await sendRefundReceiptEmail({
          jobId,
          listerId,
          refundCents,
          jobTitle,
          dateIso: nowIso,
        });
      }

      if (winnerId) await recomputeVerificationBadgesForUser(winnerId);
      if (listerId) await recomputeVerificationBadgesForUser(listerId);
      try {
        await applyReferralRewardsForCompletedJob(jobId);
      } catch {
        // non-fatal
      }

      revalidatePath(`/jobs/${jobId}`);
      revalidatePath("/disputes");
      revalidatePath("/admin/disputes");
      revalidatePath(`/admin/disputes/${jobId}`);
      revalidatePath("/my-listings");
      revalidatePath("/lister/dashboard");
      revalidatePath("/cleaner/dashboard");
      revalidatePath("/dashboard");
      revalidatePath("/earnings");
      return {
        ok: true,
        success:
          refundCents >= 1
            ? "Mediation accepted. Refund processed, escrow released to the cleaner, and the dispute is closed."
            : "Mediation accepted. Escrow released to the cleaner and the dispute is closed.",
        mediationVoteOutcome: "completed",
      };
    }
    if (vote === false) {
      const declinerLabel = isLister ? "lister" : "cleaner";
      await insertDisputeThreadEntry({
        jobId,
        authorUserId: userId,
        authorRole: isLister ? "lister" : "cleaner",
        body: `${isLister ? "Lister" : "Cleaner"} declined the admin mediation proposal. The case returns to admin for a binding final decision.`,
        isEscalationEvent: true,
      });
      const nowIso = new Date().toISOString();
      await (admin as any)
        .from("jobs")
        .update({
          dispute_mediation_status: "awaiting_admin_final",
          status: "in_review",
          dispute_status: "in_review",
          mediation_last_activity_at: nowIso,
        })
        .eq("id", jobId);

      const otherId = isLister ? j.winner_id : j.lister_id;
      if (otherId) {
        await createNotification(
          otherId,
          "dispute_opened",
          jobId,
          `The ${declinerLabel} declined the admin mediation proposal. An admin will issue a final decision — no approval needed from you.`
        );
        await sendDisputeActivityEmail({
          jobId,
          toUserId: otherId,
          subject: `[Bond Back] Job #${jobId}: mediation declined — admin will decide`,
          htmlBody: `<p>The ${declinerLabel} <strong>declined</strong> the admin mediation proposal.</p><p>An admin will apply a <strong>final settlement</strong> (refund and/or release to cleaner) to close this dispute. You do not need to approve that decision.</p>${disputeHubLinksHtml(jobId)}`,
        });
      }

      await createNotification(
        userId,
        "dispute_opened",
        jobId,
        "You declined the mediation proposal. An admin will make a final decision and notify everyone when the dispute is closed."
      );
      await sendDisputeActivityEmail({
        jobId,
        toUserId: userId,
        subject: `[Bond Back] Job #${jobId}: your response recorded`,
        htmlBody: `<p>You <strong>declined</strong> the admin mediation proposal.</p><p>Our team will review the case and apply a <strong>final settlement</strong>. You will be notified when the dispute is closed.</p>${disputeHubLinksHtml(jobId)}`,
      });

      const adminConsoleUrl = `${getSiteUrl().origin}/admin/disputes/${jobId}`;
      await notifyAdminUsersAboutJob({
        jobId,
        subject: `[Bond Back] Job #${jobId}: mediation declined — final admin decision required`,
        htmlBody: `<p>The ${declinerLabel} <strong>declined</strong> the admin mediation proposal on job #${jobId}.</p><p>Use <strong>Binding settlement (admin override)</strong> in the mediation panel (top-up $0) to refund the lister if needed, release the remainder to the cleaner, and complete the job — lister and cleaner are not asked to approve this final step. Alternatively, send a new collaborative proposal if appropriate.</p><p><a href="${adminConsoleUrl}">Open admin dispute</a></p>${disputeHubLinksHtml(jobId)}`,
        inAppMessage: `Job #${jobId}: mediation proposal declined — apply binding final settlement or send a new proposal.`,
      });

      revalidatePath(`/jobs/${jobId}`);
      revalidatePath("/disputes");
      revalidatePath("/admin/disputes");
      revalidatePath("/dashboard");
      revalidatePath("/lister/dashboard");
      revalidatePath("/cleaner/dashboard");
      return {
        ok: true,
        success:
          "You declined this proposal. An admin will make a final decision and notify all parties when the dispute is closed.",
        mediationVoteOutcome: "declined",
      };
    }

    await insertDisputeThreadEntry({
      jobId,
      authorUserId: userId,
      authorRole: isLister ? "lister" : "cleaner",
      body: `${isLister ? "Lister" : "Cleaner"} accepted the admin mediation proposal (pending the other party).`,
    });
    const otherAcc = isLister ? j.winner_id : j.lister_id;
    if (otherAcc) {
      await createNotification(
        otherAcc,
        "dispute_opened",
        jobId,
        "The other party accepted the admin mediation proposal. Your response is needed to finalize."
      );
      await sendDisputeActivityEmail({
        jobId,
        toUserId: otherAcc,
        subject: `[Bond Back] Job #${jobId}: mediation — other party accepted`,
        htmlBody: `<p>The other party <strong>accepted</strong> the admin mediation proposal. Please respond on the job or dispute hub to finalize.</p>${disputeHubLinksHtml(jobId)}`,
      });
    }

    revalidatePath("/disputes");
    revalidatePath("/admin/disputes");
    return {
      ok: true,
      success: "Your response was recorded.",
      mediationVoteOutcome: "pending_other_party",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { error: msg };
  }
}

export async function openEscalatedDispute(
  _prev: DisputeActionState | undefined,
  formData: FormData
): Promise<DisputeActionState> {
  const auth = await requireUserOrError();
  if ("error" in auth) return { error: auth.error };

  try {
    const { supabase, userId } = auth;
    const jobId = Number(formData.get("jobId"));
    const reason = trimText(formData.get("reason"));
    const details = trimText(formData.get("details"));
    const escalate = trimText(formData.get("requestMediation")) === "1";
    const photoUrls = String(formData.get("attachmentUrls") ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 5);
    const proposedRefundCentsRaw = toCents(formData.get("proposedRefundCents"));

    const { data: jobRow } = await supabase
      .from("jobs")
      .select("lister_id")
      .eq("id", jobId)
      .maybeSingle();
    const listerId = (jobRow as { lister_id?: string } | null)?.lister_id;
    const openerIsLister = Boolean(listerId && userId === listerId);
    const proposedRefundCents =
      openerIsLister && proposedRefundCentsRaw > 0 ? proposedRefundCentsRaw : undefined;

    const result = await openDispute(jobId, {
      reason,
      message: details,
      photoUrls,
      ...(proposedRefundCents != null ? { proposedRefundCents } : {}),
    });
    if (!result.ok) return { error: result.error ?? "Failed to open dispute." };

    if (escalate) {
      const admin = createSupabaseAdminClient();
      if (admin) {
        await (admin as any)
          .from("jobs")
          .update({
            dispute_escalated: true,
            dispute_mediation_status: "requested",
          })
          .eq("id", jobId);
        await (admin as any).from("dispute_messages").insert({
          job_id: jobId,
          author_user_id: null,
          author_role: "system",
          body: "Mediation requested at dispute creation.",
          attachment_urls: [],
          is_escalation_event: true,
          visible_to_lister: true,
          visible_to_cleaner: true,
        });
      }
    }
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/disputes");
    revalidatePath("/admin/disputes");
    return {
      ok: true,
      success: escalate
        ? "Dispute opened and admin mediation requested."
        : "Dispute opened. The other party will be notified.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { error: msg };
  }
}

export type AdminDisputeEmailState = { ok?: boolean; error?: string; success?: string };

/** Admin-only: send email to lister or cleaner; inserts audit row in `dispute_messages` and logs email. */
export async function sendAdminDisputePartyEmail(
  _prev: AdminDisputeEmailState | undefined,
  formData: FormData
): Promise<AdminDisputeEmailState> {
  const auth = await requireUserOrError();
  if ("error" in auth) return { error: auth.error };

  try {
    const { supabase, userId } = auth;
    const jobId = Number(formData.get("jobId"));
    const recipient = trimText(formData.get("recipient"));
    const subject = trimText(formData.get("subject"));
    const body = trimText(formData.get("body"));
    if (!jobId || !subject || body.length < 3) {
      return { error: "Enter a subject and message (at least a few characters)." };
    }
    if (recipient !== "lister" && recipient !== "cleaner") {
      return { error: "Invalid recipient." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();
    if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
      return { error: "Not authorized." };
    }

    const admin = createSupabaseAdminClient();
    if (!admin) return { error: "Server configuration error." };

    const { data: jobRow } = await admin
      .from("jobs")
      .select("lister_id, winner_id")
      .eq("id", jobId)
      .maybeSingle();
    const jr = jobRow as { lister_id: string; winner_id: string | null } | null;
    if (!jr) return { error: "Job not found." };
    const targetId = recipient === "cleaner" ? jr.winner_id : jr.lister_id;
    if (!targetId) return { error: "That party is not assigned on this job." };

    const email = await getEmailForUserId(targetId);
    const to = trimText(email);
    if (!to) return { error: "No email on file for that user." };

    const mailSubject = subject.toLowerCase().includes("job #") ? subject : `[Bond Back] Job #${jobId}: ${subject}`;
    const htmlBody = `<p><strong>Message from Bond Back</strong> regarding job #${jobId}:</p><p style="white-space:pre-wrap;">${escapeHtmlForEmail(body)}</p>${disputeHubLinksHtml(jobId)}`;
    await sendEmail(to, mailSubject, htmlBody, {
      log: { userId: targetId, kind: "dispute_admin_message" },
    });

    const partyLabel = recipient === "cleaner" ? "cleaner" : "lister";
    await insertDisputeThreadEntry({
      jobId,
      authorUserId: userId,
      authorRole: "admin",
      body: `[Email sent to ${partyLabel}]\nSubject: ${subject}\n\n${body}`,
      visibility:
        recipient === "lister"
          ? { lister: true, cleaner: false }
          : { lister: false, cleaner: true },
    });

    await createNotification(
      targetId,
      "dispute_opened",
      jobId,
      "An admin sent you an email about this dispute. Check your inbox and the dispute activity log."
    );

    revalidatePath("/admin/disputes");
    revalidatePath("/disputes");
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true, success: `Email sent to ${partyLabel}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export type AdminCaseNoteState = { ok?: boolean; error?: string; success?: string };

/**
 * Admin file note on a dispute. Visibility to lister/cleaner is off by default; parties only see the note if checked.
 */
export async function addAdminDisputeCaseNote(
  _prev: AdminCaseNoteState | undefined,
  formData: FormData
): Promise<AdminCaseNoteState> {
  const auth = await requireUserOrError();
  if ("error" in auth) return { error: auth.error };

  try {
    const { supabase, userId } = auth;
    const jobId = Number(formData.get("jobId"));
    const body = trimText(formData.get("caseNoteBody"));
    if (!jobId || body.length < 2) {
      return { error: "Enter a note (at least a couple of characters)." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();
    if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
      return { error: "Not authorized." };
    }

    const visibleToLister = formData.get("visibleToLister") === "on";
    const visibleToCleaner = formData.get("visibleToCleaner") === "on";

    await insertDisputeThreadEntry({
      jobId,
      authorUserId: userId,
      authorRole: "admin",
      body: `Admin case note\n\n${body}`,
      visibility: { lister: visibleToLister, cleaner: visibleToCleaner },
    });

    revalidatePath("/admin/disputes");
    revalidatePath("/disputes");
    revalidatePath(`/jobs/${jobId}`);

    const share =
      visibleToLister && visibleToCleaner
        ? "Shared with lister and cleaner on their dispute timeline."
        : visibleToLister
          ? "Visible to the lister on their dispute timeline."
          : visibleToCleaner
            ? "Visible to the cleaner on their dispute timeline."
            : "Internal note only — not shown to lister or cleaner.";

    return { ok: true, success: `Note saved. ${share}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
