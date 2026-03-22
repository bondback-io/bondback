import { render } from "@react-email/render";
import React from "react";
import { Resend } from "resend";
import { getEmailForUserId } from "@/lib/supabase/admin";
import { NewMessage } from "@/emails/NewMessage";
import { JobCreated } from "@/emails/JobCreated";
import { JobApproved } from "@/emails/JobApproved";
import { JobMarkedComplete } from "@/emails/JobMarkedComplete";
import { DisputeOpened } from "@/emails/DisputeOpened";
import { PaymentReleased } from "@/emails/PaymentReleased";
import { FundsReady } from "@/emails/FundsReady";
import { DisputeResolved } from "@/emails/DisputeResolved";
import { JobCancelledByLister } from "@/emails/JobCancelledByLister";
import { NewBid } from "@/emails/NewBid";
import { PaymentReceipt } from "@/emails/PaymentReceipt";
import { Welcome } from "@/emails/Welcome";
import { ListerTutorial } from "@/emails/ListerTutorial";
import { CleanerTutorial } from "@/emails/CleanerTutorial";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM ?? "Bond Back <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";

export type NotificationType =
  | "job_accepted"
  | "new_message"
  | "job_completed"
  | "payment_released"
  | "funds_ready"
  | "dispute_opened"
  | "dispute_resolved"
  | "job_created"
  | "new_bid"
  | "job_cancelled_by_lister";

/**
 * Send a single email via Resend.
 * Skips sending (returns ok: true) if global_settings.emails_enabled is false (emergency kill switch).
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Resend not configured" };

  const { getGlobalSettings } = await import("@/lib/actions/global-settings");
  const globalSettings = await getGlobalSettings();
  if (globalSettings?.emails_enabled === false) {
    return { ok: true }; // skip send; don't treat as failure
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject,
    html: htmlContent,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Extract $X from message for Payment Released subject/display if present */
function parseAmountFromMessage(messageText: string): string | undefined {
  const match = messageText.match(/\$(\d+(?:\.\d{2})?)/);
  return match ? `$${match[1]}` : undefined;
}

/** Admin override: use this subject and HTML when active. Body may use {{message}}, {{jobId}}, {{senderName}}, {{listingId}}. */
export type AdminEmailOverride = {
  subject: string;
  body: string;
  active: boolean;
};

/** Sample data for placeholder substitution (preview / test send). */
export type PlaceholderData = {
  messageText: string;
  jobId: number | null;
  senderName?: string;
  listingId?: number | null;
};

/**
 * Substitute placeholders in admin template body. Exported for preview/test.
 */
export function substitutePlaceholders(
  body: string,
  messageText: string,
  jobId: number | null,
  senderName?: string,
  listingId?: number | null
): string {
  return body
    .replace(/\{\{message\}\}/g, messageText)
    .replace(/\{\{jobId\}\}/g, String(jobId ?? ""))
    .replace(/\{\{senderName\}\}/g, senderName ?? "")
    .replace(/\{\{listingId\}\}/g, String(listingId ?? jobId ?? ""));
}

/**
 * Build subject and HTML for a notification email. Uses admin override when provided and active; otherwise uses default React Email templates.
 */
export async function getNotificationEmailContent(
  type: NotificationType,
  jobId: number | null,
  messageText: string,
  options: { senderName?: string; listingId?: number | null },
  adminOverride?: AdminEmailOverride | null
): Promise<{ subject: string; html: string }> {
  if (adminOverride?.active && adminOverride.subject?.trim() && adminOverride.body?.trim()) {
    const { markdownToHtml } = await import("@/lib/markdown");
    const bodyHtml = markdownToHtml(adminOverride.body);
    const html = substitutePlaceholders(
      bodyHtml,
      messageText,
      jobId,
      options.senderName,
      options.listingId
    );
    return { subject: adminOverride.subject.trim(), html };
  }
  return buildNotificationEmail(
    type,
    jobId,
    messageText,
    options.senderName,
    options.listingId ?? undefined
  );
}

/**
 * Build subject and HTML for a notification type using React Email templates.
 * Optional senderName for new_message; optional listingId for new_bid (link to listing).
 */
export async function buildNotificationEmail(
  type: NotificationType,
  jobId: number | null,
  messageText: string,
  senderName?: string,
  listingId?: number | null
): Promise<{ subject: string; html: string }> {
  const id = jobId ?? 0;
  const idStr = String(id);
  const listingIdStr = listingId != null ? String(listingId) : idStr;
  const messageSnippet = messageText.length > 100 ? `${messageText.slice(0, 97)}…` : messageText;

  const subjects: Record<NotificationType, string> = {
    new_message: `New message from ${senderName ?? "someone"} in Job #${id} – Bond Back`,
    new_bid: `New bid on your listing – Bond Back`,
    job_created: `Your job has been accepted – start coordinating! – Bond Back`,
    job_accepted: `Lister approved – time to clean! – Bond Back`,
    job_completed: `Cleaner marked job complete – review & approve – Bond Back`,
    payment_released: (() => {
      const amt = parseAmountFromMessage(messageText);
      return amt ? `Payment of ${amt} released – thank you! – Bond Back` : `Payment released – Job #${id} – Bond Back`;
    })(),
    funds_ready: `Ready to release funds – Job #${id} – Bond Back`,
    dispute_opened: `Dispute update on Job #${id} – Bond Back`,
    dispute_resolved: `Dispute resolved – Job #${id} – Bond Back`,
    job_cancelled_by_lister: `Job #${id} cancelled by lister – Bond Back`,
  };

  let element: React.ReactElement;
  switch (type) {
    case "new_message":
      element = React.createElement(NewMessage, {
        jobId: idStr,
        messageSnippet,
        senderName,
      });
      break;
    case "job_created":
      element = React.createElement(JobCreated, { jobId: idStr, messageText });
      break;
    case "new_bid":
      element = React.createElement(NewBid, {
        listingId: listingIdStr,
        messageText: messageText || undefined,
      });
      break;
    case "job_accepted":
      element = React.createElement(JobApproved, { jobId: idStr, messageText });
      break;
    case "job_completed":
      element = React.createElement(JobMarkedComplete, { jobId: idStr, messageText });
      break;
    case "payment_released": {
      const amountDisplay = parseAmountFromMessage(messageText);
      element = React.createElement(PaymentReleased, {
        jobId: idStr,
        messageText,
        amountDisplay,
      });
      break;
    }
    case "funds_ready":
      element = React.createElement(FundsReady, { jobId: idStr, messageText });
      break;
    case "dispute_opened":
      element = React.createElement(DisputeOpened, { jobId: idStr, messageText });
      break;
    case "dispute_resolved":
      element = React.createElement(DisputeResolved, { jobId: idStr, messageText });
      break;
    case "job_cancelled_by_lister":
      element = React.createElement(JobCancelledByLister, { jobId: idStr, messageText });
      break;
    default:
      element = React.createElement(JobCreated, {
        jobId: idStr,
        messageText: messageText || "You have a new notification.",
      });
  }

  const html = await render(element);
  const subject = subjects[type] ?? `Notification – Bond Back`;
  return { subject, html };
}

/**
 * Build welcome email (sent immediately after signup confirmation).
 * Subject and preheader tuned for engagement.
 */
export async function buildWelcomeEmail(
  firstName: string | undefined,
  role: "lister" | "cleaner" | "both"
): Promise<{ subject: string; html: string }> {
  const subject = "Welcome to Bond Back – Your Bond Cleaning Solution Awaits!";
  const element = React.createElement(Welcome, {
    firstName: firstName?.trim() || undefined,
    role,
  });
  const html = await render(element);
  return { subject, html };
}

/**
 * Build role-specific tutorial email (sent 24h after signup).
 * Subjects and preheader tuned for engagement.
 */
export async function buildTutorialEmail(
  role: "lister" | "cleaner",
  firstName?: string
): Promise<{ subject: string; html: string }> {
  const subject =
    role === "lister"
      ? "Your Quick Start Guide as a Lister on Bond Back"
      : "Your Quick Start Guide as a Cleaner on Bond Back";
  const element =
    role === "lister"
      ? React.createElement(ListerTutorial, {
          firstName: firstName?.trim() || undefined,
        })
      : React.createElement(CleanerTutorial, {
          firstName: firstName?.trim() || undefined,
        });
  const html = await render(element);
  return { subject, html };
}

/**
 * Build payment receipt email (lister paid / cleaner received / refund). Includes GST/ABN note when platformAbn set.
 */
export async function buildPaymentReceiptEmail(params: {
  variant: "lister" | "cleaner" | "refund";
  jobId: number;
  amountCents: number;
  feeCents?: number;
  netCents?: number;
  refundCents?: number;
  jobTitle?: string | null;
  dateIso: string;
  platformAbn?: string | null;
}): Promise<{ subject: string; html: string }> {
  const element = React.createElement(PaymentReceipt, {
    ...params,
    jobId: String(params.jobId),
  });
  const html = await render(element);
  const subject =
    params.variant === "refund"
      ? `Refund receipt – Job #${params.jobId} – Bond Back`
      : params.variant === "lister"
        ? `Payment receipt – Job #${params.jobId} – Bond Back`
        : `Payout receipt – Job #${params.jobId} – Bond Back`;
  return { subject, html };
}

/**
 * Resolve recipient email by user id (uses Supabase admin). Returns null if not configured or not found.
 */
export async function getRecipientEmail(userId: string): Promise<string | null> {
  return getEmailForUserId(userId);
}
