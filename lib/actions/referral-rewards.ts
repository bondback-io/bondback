"use server";

import { revalidatePath } from "next/cache";
import { render } from "@react-email/render";
import React from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getNotificationPrefs } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { ReferralReward } from "@/emails/ReferralReward";
import { cleanerEarningsIncludingBonusCents } from "@/lib/jobs/cleaner-net-earnings";

/**
 * When a referred cleaner completes their first paid job (payment released),
 * credit both users and notify. Idempotent per job via `referral_rewards` table.
 *
 * Preconditions (checked inside):
 * - `global_settings.referral_enabled`
 * - Job `status` = completed, `payment_released_at` set, `winner_id` present
 * - Winner has `profiles.referred_by` set
 * - Job agreed amount >= `referral_min_job_amount` (dollars in settings → cents)
 * - This is the winner's first completed job with payment released
 * - Referrer monthly cap: count `referral_rewards` for referrer in UTC month < `referral_max_per_user_month`
 */
export async function applyReferralRewardsForCompletedJob(jobId: number): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const settings = await getGlobalSettings();
  if (!settings?.referral_enabled) return;

  const referrerDollars = Number(settings.referral_referrer_amount ?? 20);
  const referredDollars = Number(settings.referral_referred_amount ?? 10);
  const minJobDollars = Number(settings.referral_min_job_amount ?? 100);
  const maxPerMonth = Math.max(0, Math.floor(Number(settings.referral_max_per_user_month ?? 10)));

  const referrerCents = Math.max(0, Math.round(referrerDollars * 100));
  const referredCents = Math.max(0, Math.round(referredDollars * 100));
  const minJobCents = Math.max(0, Math.round(minJobDollars * 100));

  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select(
      "id, status, winner_id, agreed_amount_cents, payment_released_at, dispute_resolution, refund_amount, proposed_refund_amount, counter_proposal_amount, cleaner_bonus_cents_applied"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr || !job) return;

  const j = job as {
    status?: string;
    winner_id?: string | null;
    agreed_amount_cents?: number | null;
    payment_released_at?: string | null;
    dispute_resolution?: string | null;
    refund_amount?: number | null;
    proposed_refund_amount?: number | null;
    counter_proposal_amount?: number | null;
    cleaner_bonus_cents_applied?: number | null;
  };

  if (j.status !== "completed" || !j.payment_released_at || !j.winner_id?.trim()) return;

  const netToCleaner = cleanerEarningsIncludingBonusCents(j, null);
  if (netToCleaner < minJobCents) return;

  const referredUserId = j.winner_id;

  const { data: cleanerProfile } = await admin
    .from("profiles")
    .select("id, referred_by, account_credit_cents")
    .eq("id", referredUserId)
    .maybeSingle();

  const cp = cleanerProfile as {
    id: string;
    referred_by?: string | null;
    account_credit_cents?: number | null;
  } | null;

  if (!cp?.referred_by?.trim()) return;

  const referrerId = cp.referred_by.trim();
  if (referrerId === referredUserId) return;

  const { count: completedCount, error: cntErr } = await admin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("winner_id", referredUserId)
    .eq("status", "completed")
    .not("payment_released_at", "is", null);

  if (cntErr || (completedCount ?? 0) !== 1) return;

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { count: monthCount } = await admin
    .from("referral_rewards")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId)
    .gte("created_at", startOfMonth.toISOString());

  if (maxPerMonth > 0 && (monthCount ?? 0) >= maxPerMonth) {
    return;
  }

  const { data: inserted, error: insErr } = await admin
    .from("referral_rewards")
    .insert({
      job_id: jobId,
      referred_user_id: referredUserId,
      referrer_id: referrerId,
      referred_credit_cents: referredCents,
      referrer_credit_cents: referrerCents,
    } as never)
    .select("id")
    .maybeSingle();

  if (insErr) {
    if (insErr.code === "23505" || insErr.message?.includes("duplicate")) return;
    console.error("[applyReferralRewardsForCompletedJob] insert", insErr.message);
    return;
  }
  if (!inserted) return;

  const { data: refProf } = await admin
    .from("profiles")
    .select("account_credit_cents")
    .eq("id", referrerId)
    .maybeSingle();
  const refBal = (refProf as { account_credit_cents?: number | null } | null)?.account_credit_cents ?? 0;

  await admin
    .from("profiles")
    .update({
      account_credit_cents: (cp.account_credit_cents ?? 0) + referredCents,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", referredUserId);

  await admin
    .from("profiles")
    .update({
      account_credit_cents: refBal + referrerCents,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", referrerId);

  const referredMsg = `You received $${referredDollars.toFixed(2)} account credit for completing your first job (referral bonus).`;
  const referrerMsg = `You received $${referrerDollars.toFixed(2)} account credit — someone you referred completed their first job.`;

  await admin.from("notifications").insert([
    {
      user_id: referredUserId,
      type: "referral_reward",
      job_id: jobId,
      message_text: referredMsg,
    },
    {
      user_id: referrerId,
      type: "referral_reward",
      job_id: jobId,
      message_text: referrerMsg,
    },
  ] as never);

  revalidatePath("/dashboard");
  revalidatePath("/profile");

  const referredEmailHtml = await render(
    React.createElement(ReferralReward, {
      variant: "referred",
      creditDollars: `$${referredDollars.toFixed(2)}`,
      jobId,
    })
  );
  const referrerEmailHtml = await render(
    React.createElement(ReferralReward, {
      variant: "referrer",
      creditDollars: `$${referrerDollars.toFixed(2)}`,
      jobId,
    })
  );

  const prefsReferred = await getNotificationPrefs(referredUserId);
  const prefsReferrer = await getNotificationPrefs(referrerId);

  if (prefsReferred.email && prefsReferred.shouldSendEmail("referral_reward")) {
    await sendEmail(
      prefsReferred.email,
      `Nice one — $${referredDollars.toFixed(2)} referral credit landed in your account – Bond Back`,
      referredEmailHtml,
      { log: { userId: referredUserId, kind: "referral_reward" } }
    );
  }
  if (prefsReferrer.email && prefsReferrer.shouldSendEmail("referral_reward")) {
    await sendEmail(
      prefsReferrer.email,
      `Your referral came good — $${referrerDollars.toFixed(2)} credit for you – Bond Back`,
      referrerEmailHtml,
      { log: { userId: referrerId, kind: "referral_reward" } }
    );
  }
}
