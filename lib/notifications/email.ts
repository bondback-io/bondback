import { render } from "@react-email/render";
import React from "react";
import { Resend } from "resend";
import { getEmailForUserId } from "@/lib/supabase/admin";
import {
  substituteEmailTemplatePlaceholders,
  parseAmountFromMessageForEmail,
  type EmailPlaceholderValues,
} from "@/lib/email-placeholders";
import { resolveEmailPlaceholderValues } from "@/lib/email-placeholders-resolve";
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
import { GenericNotification } from "@/emails/GenericNotification";
import {
  emailBrowseJobsUrl,
  emailDashboardUrl,
  emailJobUrl,
  emailListingUrl,
} from "@/lib/marketplace/email-links";

const resend = process.env.RESEND_API_KEY?.trim()
  ? new Resend(process.env.RESEND_API_KEY.trim())
  : null;

const FROM = process.env.RESEND_FROM ?? "Bond Back <noreply@bondback.io>";
const REPLY_TO = process.env.RESEND_REPLY_TO?.trim() || undefined;

/** Log once per server process: Resend env (no secrets). Helps diagnose Vercel/local “no emails”. */
let loggedResendEnvSnapshot = false;
function logResendEnvSnapshotOnce(): void {
  if (loggedResendEnvSnapshot) return;
  loggedResendEnvSnapshot = true;
  const hasKey = Boolean(process.env.RESEND_API_KEY?.trim());
  console.info("[email:resend-env]", {
    hasResendApiKey: hasKey,
    from: FROM,
    replyTo: REPLY_TO ?? null,
    ...(hasKey
      ? {}
      : {
          hint:
            "Set RESEND_API_KEY in server env (Vercel → Project → Settings → Environment Variables). Without it, sendEmail returns ok:false for every attempt.",
        }),
  });
}

function maskEmailForLog(to: string): string {
  const at = to.indexOf("@");
  if (at < 1) return "***";
  return `${to.slice(0, Math.min(2, at))}***${to.slice(at)}`;
}

/** Structured console log for every Resend attempt (success, failure, or skip). Visible on Vercel runtime logs. */
function logEmailAttempt(params: {
  outcome: "sent" | "failed" | "skipped";
  to: string;
  subject: string;
  kind?: string;
  error?: string;
  resendId?: string;
  skipReason?: string;
}): void {
  const payload = {
    outcome: params.outcome,
    kind: params.kind ?? "—",
    to: maskEmailForLog(params.to),
    subject: params.subject.slice(0, 100),
    from: FROM,
    replyTo: REPLY_TO ?? null,
    ...(params.resendId ? { resendId: params.resendId } : {}),
    ...(params.error ? { error: params.error } : {}),
    ...(params.skipReason ? { skipReason: params.skipReason } : {}),
  };
  if (params.outcome === "failed") {
    console.error("[email:resend]", payload);
  } else {
    console.info("[email:resend]", payload);
  }
}

export type NotificationType =
  | "job_accepted"
  | "job_approved_to_start"
  | "new_message"
  | "job_completed"
  | "payment_released"
  | "funds_ready"
  | "dispute_opened"
  | "dispute_resolved"
  | "job_created"
  | "new_bid"
  | "job_cancelled_by_lister"
  | "listing_cancelled_by_lister"
  | "listing_live"
  | "after_photos_uploaded"
  | "auto_release_warning"
  | "checklist_all_complete"
  | "new_job_in_area"
  | "job_status_update"
  | "early_accept_declined";

export type SendEmailOptions = {
  /** When set, logs to email_logs (and always logs a masked line to console). */
  log?: { userId: string; kind: string };
};

/**
 * Send a single email via Resend.
 *
 * **Env:** `RESEND_API_KEY` (required to send). `RESEND_FROM` — full From header, default
 * `Bond Back <noreply@bondback.io>` when unset (verify `bondback.io` in Resend). For local dev
 * without a verified domain, set `RESEND_FROM=Bond Back <onboarding@resend.dev>`. `RESEND_REPLY_TO` — optional Reply-To.
 * Every attempt logs to console as `[email:resend]` with outcome, kind, masked recipient, from/replyTo.
 *
 * Skips sending (returns ok: true, skipped) if global_settings.emails_enabled is false.
 * No-op if RESEND_API_KEY is not set (returns ok: false).
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
  options?: SendEmailOptions
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  logResendEnvSnapshotOnce();
  const { logEmailDelivery } = await import("@/lib/supabase/admin");

  if (!resend) {
    const err = "Resend not configured (missing RESEND_API_KEY)";
    logEmailAttempt({
      outcome: "failed",
      to,
      subject,
      kind: options?.log?.kind,
      error: err,
    });
    if (options?.log) {
      await logEmailDelivery({
        userId: options.log.userId,
        kind: options.log.kind,
        subject,
        to,
        status: "failed",
        errorMessage: err,
      });
    }
    return { ok: false, error: err };
  }

  const { getGlobalSettings } = await import("@/lib/actions/global-settings");
  const globalSettings = await getGlobalSettings();
  if (globalSettings?.emails_enabled === false) {
    logEmailAttempt({
      outcome: "skipped",
      to,
      subject,
      kind: options?.log?.kind ?? "transactional",
      skipReason: "global_settings.emails_enabled=false (Admin → Global settings)",
    });
    return { ok: true, skipped: true };
  }

  try {
    const payload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      reply_to?: string;
    } = {
      from: FROM,
      to: [to],
      subject,
      html: htmlContent,
    };
    if (REPLY_TO) payload.reply_to = REPLY_TO;

    const { data, error } = await resend.emails.send(payload);
    if (error) {
      logEmailAttempt({
        outcome: "failed",
        to,
        subject,
        kind: options?.log?.kind,
        error: error.message,
      });
      if (options?.log) {
        await logEmailDelivery({
          userId: options.log.userId,
          kind: options.log.kind,
          subject,
          to,
          status: "failed",
          errorMessage: error.message,
        });
      }
      return { ok: false, error: error.message };
    }
    const resendId = (data as { id?: string } | undefined)?.id;
    logEmailAttempt({
      outcome: "sent",
      to,
      subject,
      kind: options?.log?.kind,
      resendId,
    });
    if (options?.log) {
      await logEmailDelivery({
        userId: options.log.userId,
        kind: options.log.kind,
        subject,
        to,
        status: "sent",
      });
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logEmailAttempt({
      outcome: "failed",
      to,
      subject,
      kind: options?.log?.kind,
      error: msg,
    });
    if (options?.log) {
      await logEmailDelivery({
        userId: options.log.userId,
        kind: options.log.kind,
        subject,
        to,
        status: "failed",
        errorMessage: msg,
      });
    }
    return { ok: false, error: msg };
  }
}

/** Admin override: use this subject and HTML when active. Placeholders: see substituteEmailTemplatePlaceholders in lib/email-placeholders.ts */
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

/** @deprecated Use substituteEmailTemplatePlaceholders with full EmailPlaceholderValues */
export function substitutePlaceholders(
  body: string,
  messageText: string,
  jobId: number | null,
  senderName?: string,
  listingId?: number | null
): string {
  const jobIdStr = String(jobId ?? "");
  const listingIdStr = String(listingId ?? jobId ?? "");
  const v: EmailPlaceholderValues = {
    messageText,
    jobId: jobIdStr || "—",
    listingId: listingIdStr || "—",
    senderName: senderName ?? "",
    name: "Valued User",
    recipientName: "Valued User",
    listerName: "—",
    cleanerName: "—",
    listingTitle: "Your listing",
    amount: parseAmountFromMessageForEmail(messageText) ?? "$0",
    role: "Member",
    suburb: "—",
  };
  return substituteEmailTemplatePlaceholders(body, v);
}

/**
 * Build subject and HTML for a notification email. Uses admin override when provided and active; otherwise uses default React Email templates.
 */
export async function getNotificationEmailContent(
  type: NotificationType,
  jobId: number | null,
  messageText: string,
  options: {
    senderName?: string;
    listingId?: number | null;
    /** Listing primary key from DB (string UUID or numeric bigint). */
    listingUuid?: string | number | null;
    recipientUserId?: string;
  },
  adminOverride?: AdminEmailOverride | null
): Promise<{ subject: string; html: string }> {
  if (adminOverride?.active && adminOverride.subject?.trim() && adminOverride.body?.trim()) {
    try {
      const placeholderValues = await resolveEmailPlaceholderValues({
        jobId,
        messageText,
        senderName: options.senderName,
        listingId: options.listingId,
        recipientUserId: options.recipientUserId,
      });
      console.info("[email:template-props]", {
        kind: "admin_override",
        type,
        placeholderValues,
      });
      const { markdownToHtml } = await import("@/lib/markdown");
      const bodyHtml = markdownToHtml(adminOverride.body);
      const html = substituteEmailTemplatePlaceholders(bodyHtml, placeholderValues);
      const subject = substituteEmailTemplatePlaceholders(
        adminOverride.subject.trim(),
        placeholderValues
      );
      return { subject, html };
    } catch (e) {
      console.error("[email:template-render-error]", {
        kind: "admin_override",
        type,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }
  return buildNotificationEmail(
    type,
    jobId,
    messageText,
    options.senderName,
    options.listingId ?? undefined,
    options.listingUuid ?? undefined
  );
}

async function renderMarkdownEmailFromAdminOverride(
  adminOverride: AdminEmailOverride,
  placeholderValues: EmailPlaceholderValues
): Promise<{ subject: string; html: string }> {
  const { markdownToHtml } = await import("@/lib/markdown");
  const bodyHtml = markdownToHtml(adminOverride.body);
  const html = substituteEmailTemplatePlaceholders(bodyHtml, placeholderValues);
  const subject = substituteEmailTemplatePlaceholders(adminOverride.subject.trim(), placeholderValues);
  return { subject, html };
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
  listingId?: number | null,
  listingUuid?: string | number | null
): Promise<{ subject: string; html: string }> {
  const id = jobId ?? 0;
  const idStr = String(id);
  const listingIdStr = listingId != null ? String(listingId) : idStr;
  const listingKeyFromOptions =
    (listingUuid != null ? String(listingUuid).trim() : "") ||
    (listingId != null ? String(listingId).trim() : "");
  const messageSnippet = messageText.length > 100 ? `${messageText.slice(0, 97)}…` : messageText;
  const hrefForJob =
    id > 0
      ? emailJobUrl(idStr)
      : listingKeyFromOptions
        ? emailListingUrl(listingKeyFromOptions)
        : emailDashboardUrl();

  const subjects: Record<NotificationType, string> = {
    new_message: `${senderName ?? "Someone"} messaged you — Job #${id} – Bond Back`,
    new_bid: `Fresh bid on your listing — worth a look – Bond Back`,
    job_created: `Cleaner locked in — pay & start when you’re ready – Bond Back`,
    job_accepted: `You won the job — Job #${id} – Bond Back`,
    job_approved_to_start: `You’re cleared to begin Job #${id} – Bond Back`,
    job_completed: `Clean’s done — review & release when happy – Bond Back`,
    payment_released: (() => {
      const amt = parseAmountFromMessageForEmail(messageText);
      return amt
        ? `Cha-ching: ${amt} released to you – Bond Back`
        : `Payment released — Job #${id} – Bond Back`;
    })(),
    funds_ready: `Funds ready to release — Job #${id} – Bond Back`,
    dispute_opened: `Dispute opened — Job #${id} — we’ll sort it fairly – Bond Back`,
    dispute_resolved: `Dispute wrapped up — Job #${id} – Bond Back`,
    job_cancelled_by_lister: `Job #${id} cancelled by the lister – Bond Back`,
    listing_cancelled_by_lister: `Auction ended early — your bid won’t carry – Bond Back`,
    listing_live: `You’re live — cleaners can start bidding – Bond Back`,
    after_photos_uploaded: `After photos are in — Job #${id} – Bond Back`,
    auto_release_warning: `Auto-release heads-up — Job #${id} – Bond Back`,
    checklist_all_complete: `Checklist all ticked — Job #${id} – Bond Back`,
    new_job_in_area: `New bond clean near you — have a squiz – Bond Back`,
    job_status_update: `Job update — #${id} – Bond Back`,
    early_accept_declined: `Early pick update — your bid – Bond Back`,
  };

  let element: React.ReactElement;
  let templateProps: Record<string, unknown> = { type };
  switch (type) {
    case "new_message":
      templateProps = { jobId: idStr, messageSnippet, senderName };
      element = React.createElement(NewMessage, {
        jobId: idStr,
        messageSnippet,
        senderName,
      });
      break;
    case "job_created":
      templateProps = { jobId: idStr, messageText };
      element = React.createElement(JobCreated, { jobId: idStr, messageText });
      break;
    case "new_bid": {
      const bidLinkId = listingKeyFromOptions || listingIdStr;
      templateProps = { listingId: bidLinkId, messageText };
      element = React.createElement(NewBid, {
        listingId: bidLinkId,
        messageText: messageText || undefined,
      });
      break;
    }
    case "job_accepted":
      templateProps = { jobId: idStr, messageText };
      element = React.createElement(JobApproved, { jobId: idStr, messageText });
      break;
    case "job_approved_to_start":
      templateProps = { jobId: idStr, messageText };
      element = React.createElement(JobApproved, { jobId: idStr, messageText });
      break;
    case "job_completed":
      templateProps = { jobId: idStr, messageText };
      element = React.createElement(JobMarkedComplete, { jobId: idStr, messageText });
      break;
    case "payment_released": {
      const amountDisplay = parseAmountFromMessageForEmail(messageText);
      templateProps = { jobId: idStr, messageText, amountDisplay };
      element = React.createElement(PaymentReleased, {
        jobId: idStr,
        messageText,
        amountDisplay,
      });
      break;
    }
    case "funds_ready":
      templateProps = { jobId: idStr, messageText };
      element = React.createElement(FundsReady, { jobId: idStr, messageText });
      break;
    case "dispute_opened":
      templateProps = { jobId: idStr, messageText };
      element = React.createElement(DisputeOpened, { jobId: idStr, messageText });
      break;
    case "dispute_resolved":
      templateProps = { jobId: idStr, messageText };
      element = React.createElement(DisputeResolved, { jobId: idStr, messageText });
      break;
    case "job_cancelled_by_lister":
      templateProps = { jobId: idStr, messageText };
      element = React.createElement(JobCancelledByLister, { jobId: idStr, messageText });
      break;
    case "listing_cancelled_by_lister":
      templateProps = { headline: "Listing ended by the owner", messageText, hrefForJob: emailBrowseJobsUrl() };
      element = React.createElement(GenericNotification, {
        headline: "Listing ended by the owner",
        messageText:
          messageText ||
          "The property lister ended this auction early. Your bid is no longer active — find more jobs on Bond Back.",
        hrefPath: emailBrowseJobsUrl(),
        preview: "Listing ended — Bond Back",
        ctaLabel: "Browse jobs",
      });
      break;
    case "listing_live":
      templateProps = { headline: "Listing published", messageText, hrefForJob };
      element = React.createElement(GenericNotification, {
        headline: "You’re on the board — listing’s live",
        messageText: messageText || "Cleaners can see your job and start bidding.",
        hrefPath: hrefForJob,
        preview: "Your listing is live — cleaners can bid now",
      });
      break;
    case "after_photos_uploaded":
    case "auto_release_warning":
    case "checklist_all_complete":
    case "job_status_update":
    case "early_accept_declined":
    case "new_job_in_area": {
      const headlines: Record<string, string> = {
        after_photos_uploaded: "After photos are in",
        auto_release_warning: "Auto-release reminder",
        checklist_all_complete: "Checklist complete",
        job_status_update: "Something changed on your job",
        early_accept_declined: "Early pick update",
        new_job_in_area: "New job in your area",
      };
      const h = headlines[type] ?? "Update";
      templateProps = { headline: h, messageText, hrefForJob };
      element = React.createElement(GenericNotification, {
        headline: h,
        messageText: messageText || "Jump into Bond Back for the full story.",
        hrefPath: hrefForJob,
        preview: `${h} — Bond Back`,
      });
      break;
    }
    default:
      templateProps = { jobId: idStr, messageText };
      element = React.createElement(JobCreated, {
        jobId: idStr,
        messageText: messageText || "You have a new notification.",
      });
  }

  console.info("[email:react-template]", { type, templateProps });
  let html: string;
  try {
    html = await render(element);
  } catch (e) {
    console.error("[email:react-render-error]", {
      type,
      templateProps,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
  const subject = subjects[type] ?? `Notification – Bond Back`;
  return { subject, html };
}

/**
 * Build welcome email (sent immediately after signup confirmation).
 * When `adminOverride` is active with subject + body, sends markdown from Admin → Emails (centralised copy).
 * Otherwise uses the React Email template in `emails/Welcome.tsx`.
 */
export async function buildWelcomeEmail(
  firstName: string | undefined,
  role: "lister" | "cleaner" | "both",
  adminOverride?: AdminEmailOverride | null
): Promise<{ subject: string; html: string }> {
  const displayName = firstName?.trim() || "there";
  if (adminOverride?.active && adminOverride.subject?.trim() && adminOverride.body?.trim()) {
    const roleLabel =
      role === "both" ? "Lister & Cleaner" : role === "lister" ? "Lister" : "Cleaner";
    const v: EmailPlaceholderValues = {
      messageText: "",
      jobId: "—",
      listingId: "—",
      senderName: "",
      name: displayName,
      recipientName: displayName,
      listerName: "—",
      cleanerName: "—",
      listingTitle: "Your listing",
      amount: "$0",
      role: roleLabel,
      suburb: "—",
    };
    console.info("[email:template-props]", { kind: "admin_override", type: "welcome", templateProps: v });
    try {
      return await renderMarkdownEmailFromAdminOverride(adminOverride, v);
    } catch (e) {
      console.error("[email:welcome-override-fallback]", {
        error: e instanceof Error ? e.message : String(e),
        note: "Falling back to React Welcome template",
      });
    }
  }

  const subject = "Welcome to Bond Back — fair cleans, secure pay 🇦🇺";
  const templateProps = { firstName: firstName?.trim() || undefined, role };
  console.info("[email:react-template]", { type: "welcome", templateProps });
  const element = React.createElement(Welcome, templateProps);
  let html: string;
  try {
    html = await render(element);
  } catch (e) {
    console.error("[email:react-render-error]", {
      type: "welcome",
      templateProps,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
  return { subject, html };
}

/**
 * Build role-specific tutorial email (sent when the user gains that role, or by 24h cron fallback).
 * When `adminOverride` is active with subject + body, sends markdown from Admin → Emails.
 * Otherwise uses `emails/ListerTutorial.tsx` / `emails/CleanerTutorial.tsx`.
 */
export async function buildTutorialEmail(
  role: "lister" | "cleaner",
  firstName?: string,
  adminOverride?: AdminEmailOverride | null
): Promise<{ subject: string; html: string }> {
  const displayName = firstName?.trim() || "there";
  if (adminOverride?.active && adminOverride.subject?.trim() && adminOverride.body?.trim()) {
    const v: EmailPlaceholderValues = {
      messageText: "",
      jobId: "—",
      listingId: "—",
      senderName: "",
      name: displayName,
      recipientName: displayName,
      listerName: "—",
      cleanerName: "—",
      listingTitle: "Your listing",
      amount: "$0",
      role: role === "lister" ? "Lister" : "Cleaner",
      suburb: "—",
    };
    console.info("[email:template-props]", { kind: "admin_override", type: `tutorial_${role}`, templateProps: v });
    try {
      return await renderMarkdownEmailFromAdminOverride(adminOverride, v);
    } catch (e) {
      console.error("[email:tutorial-override-fallback]", {
        role,
        error: e instanceof Error ? e.message : String(e),
        note: "Falling back to React ListerTutorial/CleanerTutorial",
      });
    }
  }

  const subject =
    role === "lister"
      ? "Your lister playbook — four steps to handover – Bond Back"
      : "Your cleaner playbook — browse, clean, get paid – Bond Back";
  const templateProps = { firstName: firstName?.trim() || undefined };
  console.info("[email:react-template]", { type: `tutorial_${role}`, templateProps });
  const element =
    role === "lister"
      ? React.createElement(ListerTutorial, templateProps)
      : React.createElement(CleanerTutorial, templateProps);
  let html: string;
  try {
    html = await render(element);
  } catch (e) {
    console.error("[email:react-render-error]", {
      type: `tutorial_${role}`,
      templateProps,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
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
  const templateProps = {
    ...params,
    jobId: String(params.jobId),
    jobTitle: params.jobTitle ?? undefined,
    platformAbn: params.platformAbn ?? undefined,
  };
  console.info("[email:react-template]", {
    type: "payment_receipt",
    variant: params.variant,
    templateProps: {
      jobId: templateProps.jobId,
      variant: params.variant,
      amountCents: params.amountCents,
      jobTitle: templateProps.jobTitle,
    },
  });
  const element = React.createElement(PaymentReceipt, templateProps);
  let html: string;
  try {
    html = await render(element);
  } catch (e) {
    console.error("[email:react-render-error]", {
      type: "payment_receipt",
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
  const subject =
    params.variant === "refund"
      ? `Refund receipt — Job #${params.jobId} – Bond Back`
      : params.variant === "lister"
        ? `Payment receipt — Job #${params.jobId} – Bond Back`
        : `Payout receipt — Job #${params.jobId} – Bond Back`;
  return { subject, html };
}

/**
 * Resolve recipient email by user id (uses Supabase admin). Returns null if not configured or not found.
 */
export async function getRecipientEmail(userId: string): Promise<string | null> {
  return getEmailForUserId(userId);
}
