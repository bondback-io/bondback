"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, getEmailForUserId } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/notifications";
import { createJobTopUpCheckoutSession, openDispute } from "@/lib/actions/jobs";
import { sendEmail } from "@/lib/notifications/email";

function trimText(v: unknown): string {
  return String(v ?? "").trim();
}

function toCents(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = trimText(session?.user?.id);
  if (!userId) throw new Error("Not authenticated");
  return { supabase, userId };
}

export async function submitCleanerAdditionalPaymentRequest(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const jobId = Number(formData.get("jobId"));
  const amountCents = toCents(formData.get("amountCents"));
  const reason = trimText(formData.get("reason"));
  if (!jobId || amountCents < 100 || !reason) {
    throw new Error("Invalid request details.");
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, winner_id, lister_id, status")
    .eq("id", jobId)
    .maybeSingle();
  const row = job as { winner_id?: string | null; lister_id?: string | null; status?: string } | null;
  if (!row || row.winner_id !== userId) throw new Error("Only assigned cleaner can request this.");
  if (!["in_progress", "completed_pending_approval", "disputed", "dispute_negotiating"].includes(String(row.status ?? ""))) {
    throw new Error("This job is not eligible for additional payment request.");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Missing admin client.");
  await (admin as any).from("cleaner_additional_payment_requests").insert({
    job_id: jobId,
    cleaner_id: userId,
    lister_id: row.lister_id,
    amount_cents: amountCents,
    reason,
    status: "pending",
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
      await sendEmail(
        trimText(listerEmail),
        `[BB-DISPUTE-${jobId}] Additional Payment Requested`,
        `<p>Your cleaner requested an additional payment for Job #${jobId}.</p><p><strong>Amount:</strong> $${(amountCents / 100).toFixed(2)}</p><p><strong>Reason:</strong> ${reason.replace(/</g, "&lt;")}</p>`
      );
    }
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/disputes");
}

export async function reviewCleanerAdditionalPaymentRequest(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const requestId = trimText(formData.get("requestId"));
  const decision = trimText(formData.get("decision"));
  if (!requestId || !["accept", "deny"].includes(decision)) throw new Error("Invalid review request.");

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Missing admin client.");
  const { data } = await (admin as any)
    .from("cleaner_additional_payment_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  const req = data as any;
  if (!req || req.lister_id !== userId) throw new Error("Only the lister can review this request.");
  if (req.status !== "pending") throw new Error("This request was already reviewed.");

  if (decision === "deny") {
    await (admin as any)
      .from("cleaner_additional_payment_requests")
      .update({ status: "denied", responded_by: userId, responded_at: new Date().toISOString() })
      .eq("id", requestId);
    await createNotification(req.cleaner_id, "job_status_update", req.job_id, "Lister denied your additional payment request.");
    revalidatePath(`/jobs/${req.job_id}`);
    revalidatePath("/disputes");
    return;
  }

  const topUp = await createJobTopUpCheckoutSession(Number(req.job_id), Number(req.amount_cents), `Additional Payment Requested by Cleaner: ${String(req.reason ?? "").slice(0, 180)}`);
  if (!topUp.ok) throw new Error(topUp.error ?? "Could not create Stripe session.");

  await (admin as any)
    .from("cleaner_additional_payment_requests")
    .update({
      status: "accepted",
      responded_by: userId,
      responded_at: new Date().toISOString(),
      accepted_checkout_session_id: null,
    })
    .eq("id", requestId);

  await createNotification(req.cleaner_id, "job_status_update", req.job_id, "Lister accepted your additional payment request.");
  revalidatePath(`/jobs/${req.job_id}`);
  revalidatePath("/disputes");
}

export async function submitDisputeMessage(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const jobId = Number(formData.get("jobId"));
  const body = trimText(formData.get("body"));
  const escalate = trimText(formData.get("escalate")) === "1";
  const attachmentUrls = String(formData.get("attachmentUrls") ?? "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!jobId || body.length < 2) throw new Error("Message is too short.");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status")
    .eq("id", jobId)
    .maybeSingle();
  const j = job as { lister_id?: string | null; winner_id?: string | null; status?: string } | null;
  if (!j) throw new Error("Job not found.");
  const isParty = userId === j.lister_id || userId === j.winner_id;
  if (!isParty) throw new Error("Not authorized.");

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Missing admin client.");
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
    await createNotification(otherUserId, "dispute_opened", jobId, escalate ? "Dispute escalated for admin mediation." : "New dispute message received.");
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
  await (admin as any).from("jobs").update({
    dispute_mediation_status: "proposed",
    mediation_proposal: proposalText,
    mediation_last_activity_at: new Date().toISOString(),
  }).eq("id", jobId);
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

export async function respondToMediationProposal(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const jobId = Number(formData.get("jobId"));
  const vote = trimText(formData.get("vote")) === "accept";
  if (!jobId) throw new Error("Missing job.");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id")
    .eq("id", jobId)
    .maybeSingle();
  const j = job as any;
  if (!j) throw new Error("Job not found.");
  const isLister = userId === j.lister_id;
  const isCleaner = userId === j.winner_id;
  if (!isLister && !isCleaner) throw new Error("Not authorized.");

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Missing admin client.");
  const { data: latest } = await (admin as any)
    .from("dispute_mediation_votes")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) throw new Error("No proposal found.");

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
  if (!u) throw new Error("Could not update vote.");

  if (u.lister_accepted === true && u.cleaner_accepted === true) {
    await (admin as any).from("jobs").update({
      dispute_mediation_status: "accepted",
      status: "completed",
      dispute_status: "completed",
      resolution_type: "mediation",
      resolution_at: new Date().toISOString(),
      proposed_refund_amount: Number(u.refund_cents ?? 0),
      counter_proposal_amount: null,
    }).eq("id", jobId);
    if (Number(u.additional_payment_cents ?? 0) > 0) {
      await createJobTopUpCheckoutSession(jobId, Number(u.additional_payment_cents), "Mediation-approved additional payment");
    }
  } else if (vote === false) {
    await (admin as any).from("jobs").update({
      dispute_mediation_status: "rejected",
      status: "in_review",
      dispute_status: "in_review",
    }).eq("id", jobId);
  }

  revalidatePath("/disputes");
  revalidatePath("/admin/disputes");
}

export async function openEscalatedDispute(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
  const reason = trimText(formData.get("reason"));
  const details = trimText(formData.get("details"));
  const escalate = trimText(formData.get("requestMediation")) === "1";
  const photoUrls = String(formData.get("attachmentUrls") ?? "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 5);
  const proposedRefundCents = toCents(formData.get("proposedRefundCents"));

  const result = await openDispute(jobId, {
    reason,
    message: details,
    photoUrls,
    ...(proposedRefundCents > 0 ? { proposedRefundCents } : {}),
  });
  if (!result.ok) throw new Error(result.error ?? "Failed to open dispute.");

  if (escalate) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      await (admin as any).from("jobs").update({
        dispute_escalated: true,
        dispute_mediation_status: "requested",
      }).eq("id", jobId);
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
}
