import { fetchPlatformFeePercentForListing } from "@/lib/platform-fee";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { normalizeListerNonresponsiveCancelIdleDays } from "@/lib/global-settings/lister-nonresponsive-idle-days";
import {
  getCleanerLastActivityAtMs,
  idleLongEnoughForNonResponsiveCancel,
  nonResponsiveCancelIdleMsFromDays,
} from "@/lib/jobs/cleaner-last-activity";
import { trimStr } from "@/lib/utils";
import {
  type ListerNonResponsiveCancelPreview,
  computeNonResponsiveCancellationAmounts,
} from "@/lib/jobs/lister-nonresponsive-cancel-shared";

/**
 * Server-only preview for lister job UI (caller must ensure viewer is lister).
 */
export async function getListerNonResponsiveCancelPreview(
  supabase: SupabaseClient<Database, "public", any>,
  job: {
    id: number;
    lister_id: string;
    winner_id: string | null;
    status: string | null;
    listing_id: string | null;
    agreed_amount_cents: number | null;
    payment_intent_id: string | null;
    payment_released_at: string | null;
    escrow_funded_at?: string | null;
    created_at?: string | null;
    lister_escrow_cancelled_at?: string | null;
    disputed_at?: string | null;
    dispute_status?: string | null;
  }
): Promise<ListerNonResponsiveCancelPreview> {
  if (job.lister_escrow_cancelled_at) {
    return { eligible: false, reason: "This job was already cancelled under this flow." };
  }
  const st = String(job.status ?? "").toLowerCase();
  if (!["in_progress", "accepted"].includes(st)) {
    return { eligible: false, reason: "Only available while the job is paid and active." };
  }
  if (!trimStr(job.payment_intent_id)) {
    return { eligible: false, reason: "No escrow payment on this job." };
  }
  if (trimStr(job.payment_released_at)) {
    return { eligible: false, reason: "Payment was already released from escrow." };
  }
  if (trimStr(job.disputed_at)) {
    return { eligible: false, reason: "Not available while this job has an open dispute history." };
  }
  if (["disputed", "in_review", "dispute_negotiating"].includes(st)) {
    return { eligible: false, reason: "Not available during dispute review." };
  }
  if (!job.winner_id) {
    return { eligible: false, reason: "No cleaner is assigned." };
  }

  const settings = await getGlobalSettings();
  const requiredIdleDays = normalizeListerNonresponsiveCancelIdleDays(
    settings?.lister_nonresponsive_cancel_idle_days
  );
  const requiredIdleMs = nonResponsiveCancelIdleMsFromDays(requiredIdleDays);

  const lastAct = await getCleanerLastActivityAtMs(job.id, job.winner_id);
  const idle = idleLongEnoughForNonResponsiveCancel(
    lastAct,
    job.escrow_funded_at ?? null,
    job.created_at ?? null,
    requiredIdleMs
  );
  if (!idle.ok) {
    const dayWord =
      requiredIdleDays === 1 ? "1 day" : `${Math.max(1, requiredIdleDays)} full days`;
    return {
      eligible: false,
      reason: `The cleaner must have no activity for at least ${dayWord}. Not eligible yet.`,
    };
  }

  const feePercent = await fetchPlatformFeePercentForListing(
    supabase,
    job.listing_id,
    settings
  );
  const agreed = Math.max(0, Math.round(Number(job.agreed_amount_cents ?? 0)));
  if (agreed < 1) {
    return { eligible: false, reason: "Job has no agreed amount." };
  }
  const amounts = computeNonResponsiveCancellationAmounts({
    agreedAmountCents: agreed,
    feePercent,
  });
  const idleHours = Math.max(0, (Date.now() - idle.idleSinceMs) / (60 * 60 * 1000));

  return {
    eligible: true,
    ...amounts,
    platformFeePercent: feePercent,
    idleHours,
    requiredIdleDays,
  };
}
