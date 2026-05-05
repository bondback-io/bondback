import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseJobTopUpPayments } from "@/lib/job-top-up";
import { listerPaymentDueAtFromNowIso } from "@/lib/jobs/lister-payment-deadline";
import type { Database, Json } from "@/types/supabase";

/**
 * Stripe canceled the primary uncaptured PI (expiry/abandon/etc.) but Bond Back still had
 * `payment_intent_id` set — clear it so Pay & Start can run again when status allows.
 *
 * Skip when job has separate top-up PaymentIntents (recovery needs manual reconciliation).
 *
 * Mirrors `payment_intent.canceled` webhook behavior.
 */
export async function clearStaleCanceledPrimaryEscrowHold(
  admin: SupabaseClient<Database>,
  params: {
    jobId: number;
    /** `jobs.status` before patch */
    status: string;
    listerId: string;
    winnerId: string | null;
    listingId: string | null;
    topUpPaymentsRaw: Json | null;
  }
): Promise<boolean> {
  const tops = parseJobTopUpPayments(params.topUpPaymentsRaw);
  if (tops.length > 0) {
    console.warn("[clearStaleCanceledPrimaryEscrowHold] skipped — job has top-up legs", params.jobId);
    return false;
  }

  const nowIso = new Date().toISOString();
  const listingUuid =
    typeof params.listingId === "string" && params.listingId.trim()
      ? params.listingId
      : undefined;
  const patch: Record<string, unknown> = {
    payment_intent_id: null,
    updated_at: nowIso,
  };
  if (params.status === "in_progress") {
    patch.status = "accepted";
    patch.lister_payment_due_at = listerPaymentDueAtFromNowIso();
  }

  const { error } = await admin.from("jobs").update(patch as never).eq("id", params.jobId);
  if (error) {
    console.error("[clearStaleCanceledPrimaryEscrowHold] update failed", params.jobId, error);
    return false;
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${params.jobId}`);
  revalidatePath("/dashboard");
  revalidatePath("/lister/dashboard");

  const { createNotification } = await import("@/lib/actions/notifications");
  const listerMsg =
    params.status === "completed_pending_approval"
      ? "Stripe canceled or expired the card hold on this job. Escrow has been cleared in Bond Back — contact support if the clean still needs payout."
      : "Stripe canceled or expired the card hold on this job. Use Pay & Start again on this visit to place a fresh hold.";
  try {
    await createNotification(params.listerId, "job_status_update", params.jobId, listerMsg, {
      listingUuid,
    });
  } catch (e) {
    console.error("[clearStaleCanceledPrimaryEscrowHold] lister notify failed", e);
  }
  if (params.winnerId) {
    try {
      await createNotification(
        params.winnerId,
        "job_status_update",
        params.jobId,
        params.status === "completed_pending_approval"
          ? "The lister’s payment hold expired or was canceled in Stripe — Bond Back notified them. Hang tight unless support contacts you."
          : "The lister’s payment hold expired or was canceled — they need to Pay & Start again before escrow is active.",
        { listingUuid }
      );
    } catch (e) {
      console.error("[clearStaleCanceledPrimaryEscrowHold] cleaner notify failed", e);
    }
  }

  return true;
}
