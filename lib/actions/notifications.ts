"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import {
  createSupabaseAdminClient,
  getNotificationPrefs,
  checkAndRecordEmailRateLimit,
  recipientViewedJobRecently,
  logEmailSent,
} from "@/lib/supabase/admin";
import {
  getNotificationEmailContent,
  sendEmail,
  buildPaymentReceiptEmail,
  type NotificationType as EmailNotificationType,
} from "@/lib/notifications/email";
import { getGlobalSettings, getEmailTemplateOverrides } from "@/lib/actions/global-settings";

type NotificationInsert =
  Database["public"]["Tables"]["notifications"]["Insert"];

export type NotificationType =
  | "job_accepted"
  | "new_message"
  | "job_completed"
  | "payment_released"
  | "funds_ready"
  | "dispute_opened"
  | "dispute_resolved"
  | "job_created"
  | "job_approved_to_start"
  | "new_bid"
  | "job_cancelled_by_lister"
  | "referral_reward";

export type CreateNotificationOptions = {
  senderName?: string;
  /** For new_bid: listing id so the email links to /listings/{id} */
  listingId?: number;
  /** For SMS: job/listing title (e.g. bid accepted, job won) */
  listingTitle?: string | null;
  /** For SMS: payment amount in cents (e.g. payment released) */
  amountCents?: number | null;
};

export async function createNotification(
  userId: string,
  type: NotificationType,
  jobId: number | null,
  messageText: string,
  options?: CreateNotificationOptions
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const row: NotificationInsert = {
    user_id: userId,
    type,
    job_id: jobId ?? null,
    message_text: messageText,
  };

  // Use admin client so we can insert for any user_id (RLS only allows auth.uid() = user_id for anon)
  const admin = createSupabaseAdminClient();
  const client = admin ?? supabase;
  const { error } = await client.from("notifications").insert(row as never);

  if (error) {
    console.error("[notifications] failed to insert notification", {
      error: error.message,
      row,
    });
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");

  const globalSettings = await getGlobalSettings();
  const prefs = await getNotificationPrefs(userId);
  const numericJobId = jobId != null ? Number(jobId) : null;

  // Email: respect global toggle, per-type toggle, then notification_preferences and email_force_disabled
  let sendEmailThisTime = Boolean(
    type !== "job_approved_to_start" &&
    globalSettings?.emails_enabled !== false &&
    (await getEmailTemplateOverrides()).email_type_enabled?.[type] !== false &&
    prefs.email &&
    prefs.shouldSendEmail(type)
  );
  if (sendEmailThisTime && type === "new_message" && numericJobId != null) {
    const viewing = await recipientViewedJobRecently(userId, numericJobId);
    if (viewing) sendEmailThisTime = false;
  }
  if (sendEmailThisTime && numericJobId != null) {
    const allowed = await checkAndRecordEmailRateLimit(numericJobId);
    if (!allowed) sendEmailThisTime = false;
  }
  if (sendEmailThisTime) {
    const { email_templates: emailTemplates } = await getEmailTemplateOverrides();
    const adminOverride = emailTemplates[type];
    const { subject, html } = await getNotificationEmailContent(
      type as EmailNotificationType,
      jobId,
      messageText,
      { senderName: options?.senderName, listingId: options?.listingId },
      adminOverride
    );
    const result = await sendEmail(prefs.email!, subject, html);
    if (result.ok) await logEmailSent(userId, type, subject);
    else console.error("[notifications] email send failed", { userId, type, error: result.error });
  }

  // SMS: critical, high-value events only; max 5 per user per day (via sendSmsToUser)
  if (prefs.phone && prefs.shouldSendSms(type)) {
    const { sendSmsToUser } = await import("@/lib/notifications/sms");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";
    let body: string;
    if (type === "new_bid") {
      const link = options?.listingId ? `${appUrl}/jobs/${options.listingId}` : `${appUrl}/jobs`;
      body = `New bid on your listing. View: ${link}`;
    } else if (type === "job_accepted" || type === "job_created") {
      const title = (options?.listingTitle ?? "").trim() || "Job";
      body = `Your bid was accepted! Job #${jobId ?? "?"} – ${title.slice(0, 40)}. View: ${appUrl}/jobs/${jobId ?? ""}`;
    } else if (type === "job_approved_to_start") {
      body = `Lister approved – start Job #${jobId ?? "?"}. Chat: ${appUrl}/jobs/${jobId ?? ""}`;
    } else if (type === "payment_released") {
      const amount = options?.amountCents != null ? `$${(options.amountCents / 100).toFixed(0)}` : "";
      body = amount
        ? `Payment of ${amount} received for Job #${jobId ?? "?"}. View earnings: ${appUrl}/earnings`
        : `Payment received for Job #${jobId ?? "?"}. View earnings: ${appUrl}/earnings`;
    } else if (type === "dispute_opened") {
      body = `Dispute on Job #${jobId ?? "?"}. Respond now: ${appUrl}/jobs/${jobId ?? ""}`;
    } else {
      body = messageText.slice(0, 100) + (jobId != null ? ` ${appUrl}/jobs/${jobId}` : "");
    }
    const result = await sendSmsToUser(userId, prefs.phone, body);
    if (!result.ok) console.error("[notifications] SMS send failed", { userId, type, error: result.error });
  }

  // Push (Expo): critical/high-value events; max 5 per user per day
  if (prefs.expoPushToken && prefs.shouldSendPush(type)) {
    const { sendPushToUser, buildPushPayload } = await import("@/lib/notifications/push");
    const payload = buildPushPayload(type, numericJobId ?? null, {
      listingId: options?.listingId ?? undefined,
      listingTitle: options?.listingTitle ?? undefined,
      amountCents: options?.amountCents ?? undefined,
    });
    const result = await sendPushToUser(userId, prefs.expoPushToken, payload);
    if (!result.ok) console.error("[notifications] push send failed", { userId, type, error: result.error });
  }
}

/** Send payment receipt emails to lister and cleaner (on release). Respects global send_payment_receipt_emails and user receipt_emails pref. */
export async function sendPaymentReceiptEmails(params: {
  jobId: number;
  listerId: string;
  cleanerId: string | null;
  amountCents: number;
  feeCents: number;
  netCents: number;
  jobTitle?: string | null;
  dateIso: string;
}): Promise<void> {
  const settings = await getGlobalSettings();
  if (settings?.send_payment_receipt_emails === false) return;
  const platformAbn = settings?.platform_abn ?? null;
  const prefsLister = await getNotificationPrefs(params.listerId);
  const prefsCleaner = params.cleanerId ? await getNotificationPrefs(params.cleanerId) : null;
  if (!prefsLister.shouldSendEmail("payment_receipt") && !(prefsCleaner?.shouldSendEmail("payment_receipt"))) return;
  if (prefsLister.email && prefsLister.shouldSendEmail("payment_receipt")) {
    const { subject, html } = await buildPaymentReceiptEmail({
      variant: "lister",
      jobId: params.jobId,
      amountCents: params.amountCents,
      feeCents: params.feeCents,
      netCents: params.netCents,
      jobTitle: params.jobTitle,
      dateIso: params.dateIso,
      platformAbn,
    });
    const result = await sendEmail(prefsLister.email, subject, html);
    if (!result.ok) console.error("[notifications] receipt email to lister failed", { jobId: params.jobId, error: result.error });
  }
  if (params.cleanerId && prefsCleaner?.email && prefsCleaner.shouldSendEmail("payment_receipt")) {
    const { subject, html } = await buildPaymentReceiptEmail({
      variant: "cleaner",
      jobId: params.jobId,
      amountCents: params.amountCents,
      feeCents: params.feeCents,
      netCents: params.netCents,
      jobTitle: params.jobTitle,
      dateIso: params.dateIso,
      platformAbn,
    });
    const result = await sendEmail(prefsCleaner.email, subject, html);
    if (!result.ok) console.error("[notifications] receipt email to cleaner failed", { jobId: params.jobId, error: result.error });
  }
}

/** Send refund receipt email to lister. Respects global send_payment_receipt_emails and user receipt_emails pref. */
export async function sendRefundReceiptEmail(params: {
  jobId: number;
  listerId: string;
  refundCents: number;
  jobTitle?: string | null;
  dateIso: string;
}): Promise<void> {
  const settings = await getGlobalSettings();
  if (settings?.send_payment_receipt_emails === false) return;
  const platformAbn = settings?.platform_abn ?? null;
  const prefs = await getNotificationPrefs(params.listerId);
  if (!prefs.email || !prefs.shouldSendEmail("payment_receipt")) return;
  const { subject, html } = await buildPaymentReceiptEmail({
    variant: "refund",
    jobId: params.jobId,
    amountCents: 0,
    refundCents: params.refundCents,
    jobTitle: params.jobTitle,
    dateIso: params.dateIso,
    platformAbn,
  });
  const result = await sendEmail(prefs.email, subject, html);
  if (!result.ok) console.error("[notifications] refund receipt email failed", { jobId: params.jobId, error: result.error });
}

export async function markNotificationRead(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true } as Database["public"]["Tables"]["notifications"]["Update"])
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true } as Database["public"]["Tables"]["notifications"]["Update"])
    .eq("user_id", session.user.id)
    .eq("is_read", false);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// Stub for future email integration (Resend / Nodemailer).
// async function sendNotificationEmail(to: string, subject: string, body: string) {
//   // Integrate with Resend/Nodemailer here.
// }

