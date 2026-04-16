"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, getEmailForUserId } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { sendEmail } from "@/lib/notifications/email";
import { supportTicketEmailToken, ticketDisplayId } from "@/lib/support/ticket-format";
import { profileFieldIsAdmin } from "@/lib/is-admin";
import { logAdminActivity } from "@/lib/admin-activity-log";

type SupportTicketRow = Database["public"]["Tables"]["support_tickets"]["Row"];
type SupportTicketMessageRow = Database["public"]["Tables"]["support_ticket_messages"]["Row"];

function trimText(v: unknown): string {
  return String(v ?? "").trim();
}

async function requireSessionUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = trimText(user?.id);
  if (!userId) throw new Error("Not authenticated");
  return { supabase, userId };
}

async function isAdminUser(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  return profileFieldIsAdmin((data as { is_admin?: unknown } | null)?.is_admin);
}

export async function listMySupportTickets(): Promise<SupportTicketRow[]> {
  const { supabase, userId } = await requireSessionUser();
  const { data } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as SupportTicketRow[];
}

export async function loadSupportTicketForViewer(ticketId: string): Promise<{
  ticket: SupportTicketRow | null;
  isAdmin: boolean;
}> {
  const { supabase, userId } = await requireSessionUser();
  const admin = await isAdminUser(supabase, userId);
  let q = supabase.from("support_tickets").select("*").eq("id", ticketId);
  if (!admin) {
    q = q.eq("user_id", userId);
  }
  const { data } = await q.maybeSingle();
  return { ticket: (data as SupportTicketRow | null) ?? null, isAdmin: admin };
}

export async function listSupportTicketMessagesForViewer(
  ticketId: string
): Promise<SupportTicketMessageRow[]> {
  const { ticket } = await loadSupportTicketForViewer(ticketId);
  if (!ticket) return [];
  const { supabase } = await requireSessionUser();
  const { data } = await supabase
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  return (data ?? []) as SupportTicketMessageRow[];
}

async function insertSupportMessage(params: {
  ticketId: string;
  body: string;
  authorUserId: string | null;
  authorRole: "user" | "admin" | "email" | "system";
  emailFrom?: string | null;
  emailTo?: string[] | null;
  externalMessageId?: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Support messaging requires SUPABASE_SERVICE_ROLE_KEY.");
  const payload: Database["public"]["Tables"]["support_ticket_messages"]["Insert"] = {
    ticket_id: params.ticketId,
    body: params.body,
    author_user_id: params.authorUserId,
    author_role: params.authorRole,
    email_from: params.emailFrom ?? null,
    email_to: params.emailTo ?? null,
    external_message_id: params.externalMessageId ?? null,
  };
  const { error } = await admin.from("support_ticket_messages").insert(payload);
  if (error) throw new Error(error.message);
}

async function touchTicket(ticketId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const nowIso = new Date().toISOString();
  await admin
    .from("support_tickets")
    .update({
      updated_at: nowIso,
      last_activity_at: nowIso,
      auto_close_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      auto_close_warned_at: null,
    } as never)
    .eq("id", ticketId);
}

async function sendSupportReplyEmail(params: {
  ticket: SupportTicketRow;
  fromRole: "admin" | "user";
  body: string;
}): Promise<void> {
  const t = params.ticket;
  const messageId = `<support-ticket-${t.id}@bondback.io>`;
  const subject = `Re: ${trimText(t.subject) || "Support ticket"} (${ticketDisplayId(t.id)}) ${supportTicketEmailToken(t.id)}`;
  const baseHtml =
    `<p>${params.fromRole === "admin" ? "Support update from Bond Back:" : "Reply from user on Bond Back support ticket:"}</p>` +
    `<blockquote style="white-space:pre-wrap;margin:12px 0;padding:10px 12px;border-left:3px solid #94a3b8;background:#0f172a08;">${params.body.replace(/</g, "&lt;")}</blockquote>` +
    `<p style="font-size:12px;color:#64748b;">Ticket ${ticketDisplayId(t.id)} ${supportTicketEmailToken(t.id)}</p>`;

  if (params.fromRole === "admin") {
    const to = trimText(t.email);
    if (!to) return;
    await sendEmail(to, subject, baseHtml, {
      log: { userId: t.user_id, kind: "support_ticket_reply_admin" },
      headers: {
        "Message-ID": messageId,
        "In-Reply-To": messageId,
        References: messageId,
      },
    });
    return;
  }

  // User reply: notify all active admins.
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data: rows } = await admin.from("profiles").select("id, is_admin, is_deleted").eq("is_admin", true);
  for (const r of rows ?? []) {
    const row = r as { id: string; is_deleted?: boolean | null };
    if (row.is_deleted) continue;
    const to = await getEmailForUserId(row.id);
    if (!trimText(to)) continue;
    await sendEmail(trimText(to), subject, baseHtml, {
      log: { userId: row.id, kind: "support_ticket_reply_user" },
      headers: {
        "Message-ID": messageId,
        "In-Reply-To": messageId,
        References: messageId,
      },
    });
  }
}

export async function submitSupportTicketReply(formData: FormData): Promise<void> {
  const ticketId = trimText(formData.get("ticketId"));
  const body = trimText(formData.get("body"));
  if (!ticketId || !body) throw new Error("Missing ticket or message.");
  const { ticket, isAdmin } = await loadSupportTicketForViewer(ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === "closed" || ticket.status === "completed") {
    throw new Error("Ticket is closed.");
  }
  const { userId } = await requireSessionUser();
  const role: "admin" | "user" = isAdmin ? "admin" : "user";
  await insertSupportMessage({
    ticketId,
    body,
    authorUserId: userId,
    authorRole: role,
  });
  await touchTicket(ticketId);
  await sendSupportReplyEmail({ ticket, fromRole: role, body });
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
}

/** Collect storage object paths from ticket row and thread messages before row delete. */
function collectSupportAttachmentPaths(
  ticket: { attachment_urls?: string[] | null },
  messages: { attachment_urls?: string[] | null }[]
): string[] {
  const paths = new Set<string>();
  for (const u of ticket.attachment_urls ?? []) {
    const s = trimText(u);
    if (s) paths.add(s);
  }
  for (const m of messages) {
    for (const u of m.attachment_urls ?? []) {
      const s = trimText(u);
      if (s) paths.add(s);
    }
  }
  return [...paths];
}

export async function adminDeleteSupportTicket(ticketId: string): Promise<void> {
  const id = trimText(ticketId);
  if (!id) throw new Error("Missing ticket.");

  const { supabase, userId } = await requireSessionUser();
  const adminOk = await isAdminUser(supabase, userId);
  if (!adminOk) throw new Error("Not authorised.");

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY required.");

  const { data: ticket, error: loadErr } = await admin
    .from("support_tickets")
    .select("id, subject, attachment_urls")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!ticket) throw new Error("Ticket not found.");

  const { data: msgRows, error: msgErr } = await admin
    .from("support_ticket_messages")
    .select("attachment_urls")
    .eq("ticket_id", id);
  if (msgErr) throw new Error(msgErr.message);

  const paths = collectSupportAttachmentPaths(
    ticket as { attachment_urls?: string[] | null },
    (msgRows ?? []) as { attachment_urls?: string[] | null }[]
  );
  if (paths.length > 0) {
    const { error: stErr } = await admin.storage.from("support-attachments").remove(paths);
    if (stErr && process.env.NODE_ENV !== "production") {
      console.warn("[adminDeleteSupportTicket] storage remove:", stErr.message);
    }
  }

  const { error: delErr } = await admin.from("support_tickets").delete().eq("id", id);
  if (delErr) throw new Error(delErr.message);

  await logAdminActivity({
    adminId: userId,
    actionType: "support_ticket_deleted",
    targetType: "support_ticket",
    targetId: id,
    details: { subject: trimText((ticket as { subject?: string }).subject).slice(0, 120) },
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${id}`);
  revalidatePath("/support");
  revalidatePath(`/support/${id}`);
}

export async function adminUpdateSupportTicketStatus(formData: FormData): Promise<void> {
  const ticketId = trimText(formData.get("ticketId"));
  const status = trimText(formData.get("status"));
  if (!ticketId || !status) throw new Error("Missing ticket or status.");
  const { ticket, isAdmin } = await loadSupportTicketForViewer(ticketId);
  if (!ticket || !isAdmin) throw new Error("Not authorised.");
  if (!["open", "in_progress", "completed", "closed"].includes(status)) {
    throw new Error("Invalid status.");
  }
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY required.");
  const { error } = await admin
    .from("support_tickets")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === "closed" || status === "completed"
        ? { closed_reason: "manual", auto_close_after: null as string | null }
        : {
            closed_reason: null as string | null,
            auto_close_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
    } as never)
    .eq("id", ticketId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
}

export async function adminUpdateSupportTicketMeta(formData: FormData): Promise<void> {
  const ticketId = trimText(formData.get("ticketId"));
  const status = trimText(formData.get("status"));
  const priority = trimText(formData.get("priority")).toLowerCase();
  if (!ticketId) throw new Error("Missing ticket.");
  const { ticket, isAdmin } = await loadSupportTicketForViewer(ticketId);
  if (!ticket || !isAdmin) throw new Error("Not authorised.");
  if (status && !["open", "in_progress", "completed", "closed"].includes(status)) {
    throw new Error("Invalid status.");
  }
  if (priority && !["low", "medium", "high", "urgent"].includes(priority)) {
    throw new Error("Invalid priority.");
  }
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY required.");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (priority) patch.priority = priority;
  if (status === "closed" || status === "completed") {
    patch.closed_reason = "manual";
    patch.auto_close_after = null;
  } else if (status) {
    patch.closed_reason = null;
    patch.auto_close_after = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  const { error } = await admin.from("support_tickets").update(patch as never).eq("id", ticketId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
}

export async function autoCloseInactiveSupportTickets(): Promise<{
  warned: number;
  closed: number;
  ids: string[];
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { warned: 0, closed: 0, ids: [] };
  const now = Date.now();
  const warnThreshold = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString();
  const closeThreshold = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await admin
    .from("support_tickets")
    .select("id, user_id, email, subject, status, last_activity_at, auto_close_warned_at")
    .in("status", ["open", "in_progress"]);
  const tickets = (rows ?? []) as Array<{
    id: string;
    user_id: string;
    email: string | null;
    subject: string;
    status: string;
    last_activity_at: string | null;
    auto_close_warned_at: string | null;
  }>;
  let warned = 0;
  let closed = 0;
  const ids: string[] = [];
  for (const t of tickets) {
    const last = trimText(t.last_activity_at);
    if (!last) continue;
    const isCloseDue = last <= closeThreshold;
    const isWarnDue = !t.auto_close_warned_at && last <= warnThreshold;
    const token = supportTicketEmailToken(t.id);
    const subj = trimText(t.subject) || "Support ticket";
    const mail = trimText(t.email);
    if (isWarnDue && mail) {
      await sendEmail(
        mail,
        `Reminder: your support ticket will close soon (${ticketDisplayId(t.id)}) ${token}`,
        `<p>Your support ticket is inactive and will automatically close after 7 days of no activity.</p><p>Reply to keep it open.</p>`,
        {
          log: { userId: t.user_id, kind: "support_ticket_auto_close_warning" },
        }
      );
      await admin
        .from("support_tickets")
        .update({ auto_close_warned_at: new Date().toISOString() } as never)
        .eq("id", t.id);
      warned += 1;
    }
    if (isCloseDue) {
      await admin
        .from("support_tickets")
        .update({
          status: "closed",
          closed_reason: "inactive_7_days",
          auto_close_after: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", t.id);
      if (mail) {
        await sendEmail(
          mail,
          `Your ticket has been closed due to inactivity (${ticketDisplayId(t.id)}) ${token}`,
          `<p>Your ticket "${subj.replace(/</g, "&lt;")}" has been closed due to inactivity.</p><p>You can reopen it by replying or contacting support.</p>`,
          {
            log: { userId: t.user_id, kind: "support_ticket_auto_closed" },
          }
        );
      }
      closed += 1;
      ids.push(t.id);
    }
  }
  revalidatePath("/admin/support");
  revalidatePath("/support");
  return { warned, closed, ids };
}
