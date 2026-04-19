"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, getEmailForUserId } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/notifications";
import { createJobTopUpCheckoutSession, openDispute } from "@/lib/actions/jobs";
import { sendEmail } from "@/lib/notifications/email";
import { getSiteUrl } from "@/lib/site";
import { countJobAfterPhotosFromStorage } from "@/lib/jobs/after-photo-storage-count";

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

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Missing admin client.");
  await (admin as any).from("dispute_mediation_votes").insert({
    job_id: jobId,
    proposal_text: proposalText,
    refund_cents: refundCents,
    additional_payment_cents: additionalPaymentCents,
    created_by: userId,
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
    author_user_id: userId,
    author_role: "admin",
    body: `Mediation Proposal: ${proposalText}`,
    attachment_urls: [],
    is_escalation_event: false,
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
      .select("id, lister_id, winner_id")
      .eq("id", jobId)
      .maybeSingle();
    const j = job as { lister_id?: string; winner_id?: string | null } | null;
    if (!j) return { error: "Job not found." };
    const isLister = userId === j.lister_id;
    const isCleaner = userId === j.winner_id;
    if (!isLister && !isCleaner) return { error: "Not authorized." };

    const admin = createSupabaseAdminClient();
    if (!admin) return { error: "Server configuration error. Try again later." };

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
      await (admin as any)
        .from("jobs")
        .update({
          dispute_mediation_status: "accepted",
          status: "completed",
          dispute_status: "completed",
          resolution_type: "mediation",
          resolution_at: new Date().toISOString(),
          proposed_refund_amount: Number(u.refund_cents ?? 0),
          counter_proposal_amount: null,
        })
        .eq("id", jobId);
      if (Number(u.additional_payment_cents ?? 0) > 0) {
        await createJobTopUpCheckoutSession(
          jobId,
          Number(u.additional_payment_cents),
          "Mediation-approved additional payment"
        );
      }
      revalidatePath("/disputes");
      revalidatePath("/admin/disputes");
      return { ok: true, success: "Mediation accepted. The job has been updated." };
    }
    if (vote === false) {
      await (admin as any)
        .from("jobs")
        .update({
          dispute_mediation_status: "rejected",
          status: "in_review",
          dispute_status: "in_review",
        })
        .eq("id", jobId);
      revalidatePath("/disputes");
      revalidatePath("/admin/disputes");
      return { ok: true, success: "You rejected this proposal." };
    }

    revalidatePath("/disputes");
    revalidatePath("/admin/disputes");
    return { ok: true, success: "Your response was recorded." };
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
