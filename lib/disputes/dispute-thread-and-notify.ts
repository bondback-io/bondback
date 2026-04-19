import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEmailForUserId } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { getSiteUrl } from "@/lib/site";
import { createNotification } from "@/lib/actions/notifications";

function trimText(v: unknown): string {
  return String(v ?? "").trim();
}

export function escapeHtmlForEmail(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function insertDisputeThreadEntry(params: {
  jobId: number;
  authorUserId: string | null;
  authorRole: string;
  body: string;
  attachmentUrls?: string[];
  isEscalationEvent?: boolean;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.warn("[dispute thread] admin client not configured; skipping thread insert");
    return;
  }
  const { error } = await admin.from("dispute_messages").insert({
    job_id: params.jobId,
    author_user_id: params.authorUserId,
    author_role: params.authorRole,
    body: params.body,
    attachment_urls: params.attachmentUrls ?? [],
    is_escalation_event: params.isEscalationEvent ?? false,
  } as never);
  if (error) {
    console.error("[dispute thread] insert failed:", error.message);
  }
}

export async function sendDisputeActivityEmail(options: {
  jobId: number;
  toUserId: string | null | undefined;
  subject: string;
  htmlBody: string;
}): Promise<void> {
  const uid = trimText(options.toUserId);
  if (!uid) return;
  const email = await getEmailForUserId(uid);
  const to = trimText(email);
  if (!to) return;
  await sendEmail(to, options.subject, options.htmlBody, {
    log: { userId: uid, kind: "dispute_activity" },
  });
}

export function disputeHubLinksHtml(jobId: number): string {
  const origin = getSiteUrl().origin;
  const jobUrl = `${origin}/jobs/${jobId}#dispute`;
  const hubUrl = `${origin}/disputes`;
  return `<p style="margin-top:12px;font-size:14px;"><a href="${jobUrl}">Open job — dispute</a> · <a href="${hubUrl}">Dispute hub</a></p>`;
}

/** In-app + email every admin profile (mediation help requests, etc.). */
export async function notifyAdminUsersAboutJob(params: {
  jobId: number;
  subject: string;
  htmlBody: string;
  inAppMessage: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data: rows } = await admin.from("profiles").select("id").eq("is_admin", true);
  for (const r of rows ?? []) {
    const uid = String((r as { id: string }).id).trim();
    if (!uid) continue;
    await createNotification(uid, "dispute_opened", params.jobId, params.inAppMessage);
    await sendDisputeActivityEmail({
      jobId: params.jobId,
      toUserId: uid,
      subject: params.subject,
      htmlBody: params.htmlBody,
    });
  }
}
