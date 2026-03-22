"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { categorizeSupportTicket, type CategorizeResult } from "@/lib/support-categorize";
import { sendEmail } from "@/lib/notifications/email";
import { logAdminActivity } from "@/lib/admin-activity-log";
import { SUPPORT_CATEGORY_OPTIONS } from "@/lib/support-categorize";

const BUCKET = "support-attachments";
const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

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
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) {
      console.error("uploadSupportAttachments:", error);
      return { ok: false, error: error.message };
    }
    paths.push(path);
  }

  return { ok: true, paths };
}

function ticketDisplayId(uuid: string): string {
  const hex = uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `TKT-${hex}`;
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
      suggested_category: suggestedCategory || null,
      confidence: confidence != null ? Math.min(100, Math.max(0, confidence)) : null,
      ai_reason: aiReason,
      status: "open",
      email: email || null,
      job_id: jobId,
      listing_id: listingId,
      attachment_urls: attachmentUrls,
    })
    .select("id")
    .single();

  if (error) {
    console.error("submitSupportTicket:", error);
    return { ok: false, error: error.message };
  }

  const tid = data?.id ?? "";
  const displayId = ticketDisplayId(tid);

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";
  const userName = (session as any).user?.user_metadata?.full_name ?? "there";
  const confirmHtml = `
    <p>Hi ${userName},</p>
    <p>We've received your support request.</p>
    <p><strong>Ticket #${displayId}</strong><br/>
    Subject: ${sub}</p>
    <p>We'll reply within 24 hours. You can also reply to this email to add more context.</p>
    <p><a href="${appUrl}/support">View support</a></p>
    <p>— Bond Back team</p>
  `;
  if (email) {
    await sendEmail(email, `Support ticket #${displayId} received`, confirmHtml);
  }

  return { ok: true, ticketId: tid, ticketDisplayId: displayId };
}
