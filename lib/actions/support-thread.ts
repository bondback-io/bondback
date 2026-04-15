"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, getEmailForUserId } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { sendEmail } from "@/lib/notifications/email";
import { supportTicketEmailToken, ticketDisplayId } from "@/lib/support/ticket-format";

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
  return (data as { is_admin?: boolean | null } | null)?.is_admin === true;
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
  await admin
    .from("support_tickets")
    .update({ updated_at: new Date().toISOString() } as never)
    .eq("id", ticketId);
}

async function sendSupportReplyEmail(params: {
  ticket: SupportTicketRow;
  fromRole: "admin" | "user";
  body: string;
}): Promise<void> {
  const t = params.ticket;
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
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq("id", ticketId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
}
