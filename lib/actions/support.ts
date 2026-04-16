"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, getEmailForUserId } from "@/lib/supabase/admin";
import { categorizeSupportTicket, type CategorizeResult } from "@/lib/support-categorize";
import { render } from "@react-email/render";
import React from "react";
import { SupportTicketConfirmation } from "@/emails/SupportTicketConfirmation";
import { SupportTicketAdminAlert } from "@/emails/SupportTicketAdminAlert";
import { sendEmail } from "@/lib/notifications/email";
import { logAdminActivity } from "@/lib/admin-activity-log";
import { SUPPORT_CATEGORY_OPTIONS } from "@/lib/support-categorize";
import { supportTicketEmailToken, ticketDisplayId } from "@/lib/support/ticket-format";

const BUCKET = "support-attachments";
const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

function humanizeSupportTicketsDbError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("support_tickets") &&
    (m.includes("schema cache") || m.includes("could not find the table") || m.includes("does not exist"))
  ) {
    return (
      "Support tickets are not set up on this database yet. In Supabase → SQL Editor, run the script " +
      "`supabase/sql/support_tickets_complete_setup.sql` from the repo (or apply migrations including " +
      "`20250322000000_support_tickets.sql` and the follow-up support ticket migrations), then try again."
    );
  }
  return message;
}

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

async function ensureSupportAttachmentsBucket(
  admin: AdminClient
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) {
    console.warn("support attachments listBuckets:", listErr.message);
  }
  const exists = buckets?.some((b) => b.id === BUCKET) ?? false;
  if (exists) return { ok: true };

  const { error } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES],
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (
      m.includes("already exists") ||
      m.includes("resource already exists") ||
      m.includes("duplicate")
    ) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type SuggestCategoryResult =
  | { ok: true; suggestion: CategorizeResult }
  | { ok: false; error: string };

/**
 * Suggest category for a support ticket (AI or keyword fallback).
 * Call from the support form after user fills subject + description.
 */
export async function suggestSupportCategory(
  subject: string,
  description: string
): Promise<SuggestCategoryResult> {
  const sub = (subject ?? "").trim();
  const desc = (description ?? "").trim();
  if (!sub && !desc) {
    return { ok: false, error: "Add a subject or description to get a suggestion." };
  }

  try {
    const result = await categorizeSupportTicket(sub, desc);
    return { ok: true, suggestion: result };
  } catch (e) {
    console.error("support suggestCategory:", e);
    return { ok: false, error: "Could not analyze. You can still choose a category manually." };
  }
}

export type UploadSupportAttachmentsResult =
  | { ok: true; paths: string[] }
  | { ok: false; error: string };

/**
 * Upload files to support-attachments bucket. Returns storage paths to store in support_tickets.attachment_urls.
 */
export async function uploadSupportAttachments(
  formData: FormData
): Promise<UploadSupportAttachmentsResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const rawFiles = formData.getAll("files") as File[];
  const single = formData.get("file") as File | null;
  const files: File[] = rawFiles.length ? rawFiles : single ? [single] : [];
  if (files.length === 0) return { ok: true, paths: [] };
  if (files.length > MAX_FILES) return { ok: false, error: `Maximum ${MAX_FILES} files allowed.` };

  const admin = createSupabaseAdminClient();
  const storageClient = admin ?? supabase;
  if (admin) {
    const ensured = await ensureSupportAttachmentsBucket(admin);
    if (!ensured.ok) {
      return { ok: false, error: ensured.error };
    }
  }

  const prefix = `${session.user.id}/${Date.now()}`;
  const paths: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file?.size || file.size > MAX_FILE_BYTES) {
      return { ok: false, error: `File ${file?.name ?? i + 1} is empty or too large (max 5 MB).` };
    }
    const mime = file.type?.toLowerCase() ?? "";
    if (!ALLOWED_TYPES.some((t) => mime === t || mime.startsWith(t.split("/")[0] + "/"))) {
      return { ok: false, error: "Only images (JPEG, PNG, WebP, GIF) and PDF are allowed." };
    }
    const ext = file.name?.split(".").pop()?.slice(0, 4) || "bin";
    const safeName = `${i}_${ext}`;
    const path = `${prefix}_${safeName}`;
    const { error } = await storageClient.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) {
      console.error("uploadSupportAttachments:", error);
      const msg = error.message;
      if (
        !admin &&
        /bucket not found/i.test(msg)
      ) {
        return {
          ok: false,
          error:
            "Attachments are unavailable until the support file bucket is created in Supabase (or the server has no service role key). Try again without files, or contact us by email.",
        };
      }
      return { ok: false, error: msg };
    }
    paths.push(path);
  }

  return { ok: true, paths };
}

function supportDescriptionEmailPreview(raw: string, max = 400): string {
  const oneLine = (raw ?? "").replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

/**
 * Email every active admin (profiles.is_admin, not soft-deleted) when a ticket is filed.
 * Best-effort only: failures are logged; ticket submit still succeeds.
 */
async function notifyAdminsNewSupportTicket(params: {
  ticketId: string;
  ticketDisplayId: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  contactEmail: string | null;
  jobId: number | null;
  listingId: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.warn("[support-ticket-admin-email] skipped: SUPABASE_SERVICE_ROLE_KEY not set");
    return;
  }

  const { data: rows, error } = await admin
    .from("profiles")
    .select("id, is_deleted")
    .eq("is_admin", true);

  if (error) {
    console.error("[support-ticket-admin-email] failed to list admins:", error.message);
    return;
  }

  const adminIds = (rows ?? [])
    .filter((r) => !(r as { is_deleted?: boolean | null }).is_deleted)
    .map((r) => (r as { id: string }).id)
    .filter(Boolean);

  if (adminIds.length === 0) return;

  const descriptionPreview = supportDescriptionEmailPreview(params.description);
  const element = React.createElement(SupportTicketAdminAlert, {
    ticketDisplayId: params.ticketDisplayId,
    category: params.category,
    priority: params.priority,
    ticketSubject: params.subject,
    descriptionPreview,
    contactEmail: params.contactEmail,
    jobId: params.jobId,
    listingId: params.listingId,
  });

  let html: string | null = null;
  try {
    html = await render(element);
  } catch (e) {
    console.error("[support-ticket-admin-email] render failed:", e);
    return;
  }
  if (!html) return;

  const subject = `[Bond Back] New support ticket ${params.ticketDisplayId} — ${params.subject.slice(0, 60)}${params.subject.length > 60 ? "…" : ""} ${supportTicketEmailToken(params.ticketId)}`;
  const seenEmails = new Set<string>();

  for (const userId of adminIds) {
    const to = await getEmailForUserId(userId);
    if (!to?.trim()) continue;
    const key = to.trim().toLowerCase();
    if (seenEmails.has(key)) continue;
    seenEmails.add(key);

    await sendEmail(to.trim(), subject, html, {
      log: { userId, kind: "support_ticket_admin_alert" },
    });
  }
}

export type SubmitSupportTicketResult =
  | { ok: true; ticketId: string; ticketDisplayId: string }
  | { ok: false; error: string };

/**
 * Submit a support ticket. Creates row, sends confirmation email, and logs AI suggestion if present.
 */
export async function submitSupportTicket(
  subject: string,
  description: string,
  category: string,
  priority: "low" | "medium" | "high" | "urgent",
  suggestedCategory: string | null,
  confidence: number | null,
  options: {
    email?: string | null;
    jobId?: number | string | null;
    listingId?: string | null;
    attachmentPaths?: string[] | null;
    aiReason?: string | null;
  } = {}
): Promise<SubmitSupportTicketResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in to submit a ticket." };
  }

  const sub = (subject ?? "").trim();
  const desc = (description ?? "").trim();
  if (!sub) return { ok: false, error: "Subject is required." };
  if (desc.length < 50) return { ok: false, error: "Description must be at least 50 characters." };

  const categoryOption = SUPPORT_CATEGORY_OPTIONS.includes(category as any)
    ? category
    : "Other";
  const priorityOption =
    priority === "low" || priority === "medium" || priority === "high" || priority === "urgent"
      ? priority
      : "medium";
  const email = ((options.email ?? "").trim() || session.user.email) ?? null;
  const jobId =
    options.jobId != null && options.jobId !== ""
      ? Number(options.jobId)
      : null;
  const listingId =
    options.listingId != null && (options.listingId as string).trim() !== ""
      ? (options.listingId as string).trim()
      : null;
  const attachmentUrls = options.attachmentPaths?.length
    ? options.attachmentPaths
    : null;
  const aiReason =
    options.aiReason != null && (options.aiReason as string).trim() !== ""
      ? (options.aiReason as string).trim().slice(0, 500)
      : null;

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: session.user.id,
      subject: sub,
      description: desc,
      category: categoryOption,
      priority: priorityOption,
      suggested_category: suggestedCategory || null,
      confidence: confidence != null ? Math.min(100, Math.max(0, confidence)) : null,
      ai_reason: aiReason,
      status: "open",
      email: email || null,
      job_id: jobId,
      listing_id: listingId,
      attachment_urls: attachmentUrls,
      last_activity_at: new Date().toISOString(),
      auto_close_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("submitSupportTicket:", error);
    return { ok: false, error: humanizeSupportTicketsDbError(error.message) };
  }

  const tid = (data as { id?: string } | null)?.id ?? "";
  const displayId = ticketDisplayId(tid);

  // Seed threaded conversation with the original user message when table exists.
  try {
    const admin = createSupabaseAdminClient();
    const writer = admin ?? supabase;
    await (writer as any).from("support_ticket_messages").insert({
      ticket_id: tid,
      author_user_id: session.user.id,
      author_role: "user",
      body: desc,
      attachment_urls: attachmentUrls,
      email_from: email || null,
      email_to: null,
      external_message_id: null,
    });
  } catch (e) {
    console.warn("[support-ticket] initial thread insert failed (non-fatal)", e);
  }

  if (suggestedCategory != null || confidence != null || aiReason) {
    await logAdminActivity({
      adminId: null,
      actionType: "support_ai_categorize",
      targetType: "support_ticket",
      targetId: tid,
      details: {
        suggested_category: suggestedCategory ?? undefined,
        confidence: confidence ?? undefined,
        ai_reason: aiReason ?? undefined,
      },
    });
  }

  revalidatePath("/support");
  revalidatePath("/admin/support");

  const userName = (session as any).user?.user_metadata?.full_name ?? "there";
  const greeting =
    typeof userName === "string" && userName.trim() ? userName.trim().split(/\s+/)[0]! : "there";
  const element = React.createElement(SupportTicketConfirmation, {
    greetingName: greeting,
    ticketDisplayId: displayId,
    ticketSubject: sub,
  });
  let confirmHtml: string | null = null;
  try {
    confirmHtml = await render(element);
  } catch (e) {
    console.error("[support-ticket-email-render]", e);
  }
  if (email && confirmHtml) {
    await sendEmail(
      email,
      `We’ve received your message — ticket #${displayId} – Bond Back ${supportTicketEmailToken(tid)}`,
      confirmHtml,
      {
      log: { userId: session.user.id, kind: "support_ticket_confirmation" },
      }
    );
  }

  void notifyAdminsNewSupportTicket({
    ticketId: tid,
    ticketDisplayId: displayId,
    category: categoryOption,
    priority: priorityOption,
    subject: sub,
    description: desc,
    contactEmail: email,
    jobId: jobId != null && Number.isFinite(jobId) ? jobId : null,
    listingId,
  });

  return { ok: true, ticketId: tid, ticketDisplayId: displayId };
}
