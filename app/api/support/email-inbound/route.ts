import { NextResponse } from "next/server";
import { createSupabaseAdminClient, getEmailForUserId } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { supportTicketEmailToken, ticketDisplayId } from "@/lib/support/ticket-format";

const TICKET_TOKEN_RE = /\[TICKET:([0-9a-f-]{36})\]/i;

function trimText(v: unknown): string {
  return String(v ?? "").trim();
}

function extractEmailAddress(v: unknown): string | null {
  const raw = trimText(v);
  if (!raw) return null;
  const m = raw.match(/<([^>]+)>/);
  const email = (m?.[1] ?? raw).trim().toLowerCase();
  return email || null;
}

function readToken(subject: string, text: string): string | null {
  const joined = `${subject}\n${text}`;
  const m = joined.match(TICKET_TOKEN_RE);
  return m?.[1] ? m[1].toLowerCase() : null;
}

export async function POST(request: Request) {
  const secret = process.env.SUPPORT_INBOUND_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    const h = request.headers.get("x-support-inbound-secret");
    if (auth !== `Bearer ${secret}` && h !== secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 500 }
    );
  }

  let payload: any = {};
  const ctype = request.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    payload = await request.json().catch(() => ({}));
  } else if (ctype.includes("application/x-www-form-urlencoded") || ctype.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (form) {
      payload = Object.fromEntries(form.entries());
    }
  }

  const subject = trimText(payload.subject ?? payload.email_subject ?? "");
  const textBody = trimText(
    payload.text ?? payload.text_body ?? payload["stripped-text"] ?? payload["stripped_text"] ?? payload.body ?? ""
  );
  const htmlBody = trimText(payload.html ?? payload.html_body ?? "");
  const sender =
    extractEmailAddress(payload.from ?? payload.sender ?? payload.from_email) ??
    extractEmailAddress(payload["From"]);
  const externalMessageId = trimText(
    payload.message_id ?? payload["Message-Id"] ?? payload.email_id ?? payload.id ?? ""
  );
  const inReplyTo = trimText(payload["In-Reply-To"] ?? payload.in_reply_to ?? "");
  const references = trimText(payload["References"] ?? payload.references ?? "");
  const ticketId = readToken(subject, textBody || htmlBody);

  if (!ticketId || !sender) {
    return NextResponse.json({ ok: true, ignored: true, reason: "missing ticket token or sender" });
  }

  const { data: ticket } = await admin
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ ok: true, ignored: true, reason: "ticket not found" });
  }

  const supportTicket = ticket as any;
  const contactEmail = trimText(supportTicket.email).toLowerCase();
  const fromRole: "user" | "admin" = sender === contactEmail ? "user" : "admin";

  const messageBody = textBody || htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!messageBody) {
    return NextResponse.json({ ok: true, ignored: true, reason: "empty body" });
  }

  const insertPayload: any = {
    ticket_id: ticketId,
    author_user_id: fromRole === "user" ? supportTicket.user_id : null,
    author_role: fromRole,
    body: messageBody.slice(0, 8000),
    email_from: sender,
    email_to: null,
    external_message_id: externalMessageId || null,
  };
  const { error: insErr } = await admin.from("support_ticket_messages").insert(insertPayload);
  if (insErr && !insErr.message.toLowerCase().includes("duplicate")) {
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  await admin
    .from("support_tickets")
    .update({
      status: supportTicket.status === "closed" || supportTicket.status === "completed" ? "in_progress" : supportTicket.status,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", ticketId);

  // Relay to the opposite side for true email-thread behavior.
  const emailSubject = `Re: ${trimText(supportTicket.subject) || "Support ticket"} (${ticketDisplayId(ticketId)}) ${supportTicketEmailToken(ticketId)}`;
  const threadMessageId = `<support-ticket-${ticketId}@bondback.io>`;
  const threadHeaders = {
    "Message-ID": threadMessageId,
    "In-Reply-To": inReplyTo || threadMessageId,
    References: references || threadMessageId,
  };
  const html =
    `<p>${fromRole === "user" ? "User replied via email:" : "Support/admin replied via email:"}</p>` +
    `<blockquote style="white-space:pre-wrap;margin:12px 0;padding:10px 12px;border-left:3px solid #94a3b8;background:#0f172a08;">${messageBody
      .replace(/</g, "&lt;")
      .slice(0, 8000)}</blockquote>` +
    `<p style="font-size:12px;color:#64748b;">Ticket ${ticketDisplayId(ticketId)} ${supportTicketEmailToken(ticketId)}</p>`;

  if (fromRole === "user") {
    const { data: admins } = await admin
      .from("profiles")
      .select("id, is_admin, is_deleted")
      .eq("is_admin", true);
    for (const row of admins ?? []) {
      const r = row as { id: string; is_deleted?: boolean | null };
      if (r.is_deleted) continue;
      const to = await getEmailForUserId(r.id);
      if (!trimText(to)) continue;
      await sendEmail(trimText(to), emailSubject, html, {
        log: { userId: r.id, kind: "support_ticket_inbound_user_reply" },
        headers: threadHeaders,
      });
    }
  } else if (contactEmail) {
    await sendEmail(contactEmail, emailSubject, html, {
      log: { userId: supportTicket.user_id, kind: "support_ticket_inbound_admin_reply" },
      headers: threadHeaders,
    });
  }

  return NextResponse.json({ ok: true, ticketId });
}
