"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { createNotification } from "@/lib/actions/notifications";

type JobMessageInsert =
  Database["public"]["Tables"]["job_messages"]["Insert"];

export type SendJobMessageResult =
  | { ok: true }
  | { ok: false; error: string };

// Shared, user-facing moderation error message
const MODERATION_ERROR_MESSAGE =
  "All communication must stay inside Bond Back for your protection, escrow safety, dispute resolution, and to avoid account restrictions. Please remove personal contact info or external links.";

// Regex for common email formats (simple but robust)
const EMAIL_PATTERN =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;

// Regex for obvious URL patterns: protocols, www, common TLDs, shorteners
const URL_PATTERN =
  /(https?:\/\/|www\.|[A-Za-z0-9.-]+\.(?:com|net|org|io|co|app|au|uk|nz|de|fr|tv|info|ly|gg|dev|shop|store)\b|\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl)\b)/i;

// Regex for Australian mobile numbers, covering:
// 04xx xxx xxx, 04xxxxxxxx, +61 4xx xxx xxx, 614xxxxxxxx, etc.
const AU_MOBILE_PATTERN =
  /\b(?:\+?61|0)[\s\-().]*4[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d\b/;

// Generic international phone pattern:
// any +country or local number with at least 8 digits, allowing spaces/dashes/()
const INTERNATIONAL_PHONE_PATTERN =
  /\b(?:\+?\d[\d\s\-().]{7,})\b/;

// Phrases that strongly indicate an attempt to move off-platform or share contact
const OFF_PLATFORM_PHRASES = [
  "call me",
  "text me",
  "ring me",
  "my number",
  "my phone",
  "whatsapp",
  "telegram",
  "signal",
  "facebook",
  "instagram",
  "snapchat",
  "dm me",
  "message me",
  "private message",
  "pm me",
  "send me a text",
  "give you my number",
  "off app",
  "off the app",
  "off-platform",
  "off platform",
  "outside the platform",
  "outside bond back",
  "contact me directly",
  "my contact",
  "here's my details",
  "heres my details",
];

const OFF_PLATFORM_PATTERN = new RegExp(
  OFF_PLATFORM_PHRASES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i"
);

/**
 * Returns true if the message text violates any moderation rule.
 * Rules:
 * - Block emails
 * - Block URLs / domains / shorteners
 * - Block AU mobile formats and generic phone numbers
 * - Block "off platform" style phrases
 * - Block messages containing more than one space-separated token that looks like a long number
 */
function violatesModerationRules(text: string): boolean {
  const normalized = text.toLowerCase();

  // 1) Email addresses
  if (EMAIL_PATTERN.test(text)) {
    console.error("[moderation] blocked message (email detected)", { text });
    return true;
  }

  // 2) URLs and obvious domains/shorteners
  if (URL_PATTERN.test(text)) {
    console.error("[moderation] blocked message (url detected)", { text });
    return true;
  }

  // 3) Australian mobile formats
  if (AU_MOBILE_PATTERN.test(text)) {
    console.error("[moderation] blocked message (AU mobile detected)", { text });
    return true;
  }

  // 4) Generic international phone formats
  if (INTERNATIONAL_PHONE_PATTERN.test(text)) {
    console.error("[moderation] blocked message (international phone detected)", {
      text,
    });
    return true;
  }

  // 5) Off-platform / contact-evading phrases
  if (OFF_PLATFORM_PATTERN.test(normalized)) {
    console.error("[moderation] blocked message (off-platform phrase detected)", {
      text,
    });
    return true;
  }

  // 6) Multiple numeric tokens: people splitting phone numbers across words.
  // Count tokens that contain at least 3 digits (to avoid blocking simple "2 bedrooms and 3 baths").
  const numericLikeTokens = normalized
    .split(/\s+/)
    .filter((token) => (token.match(/\d/g) || []).length >= 3);
  if (numericLikeTokens.length > 1) {
    console.error("[moderation] blocked message (multiple numeric tokens)", {
      text,
      numericLikeTokens,
    });
    return true;
  }

  return false;
}

export async function sendJobMessage(
  jobId: number,
  messageText: string
): Promise<SendJobMessageResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in to send messages." };
  }

  const text = (messageText ?? "").trim();
  if (!text || text.length === 0) {
    return { ok: false, error: "Message cannot be empty." };
  }
  if (text.length > 500) {
    return { ok: false, error: "Message must be 500 characters or less." };
  }

  // Apply strict moderation rules before any DB work
  if (violatesModerationRules(text)) {
    return {
      ok: false,
      error: MODERATION_ERROR_MESSAGE,
    };
  }

  // Ensure the user is a participant on the job (lister or winner)
  const { data: job } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, payment_intent_id")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    return {
      ok: false,
      error: "You are not allowed to send messages for this job.",
    };
  }

  const j = job as {
    lister_id: string;
    winner_id: string | null;
    status: string;
    payment_intent_id?: string | null;
  };

  if (![j.lister_id, j.winner_id].includes(session.user.id)) {
    return {
      ok: false,
      error: "You are not allowed to send messages for this job.",
    };
  }

  // Only allow chat once funds are held or the job is active:
  // - in_progress / completed (funds in escrow and work underway or done)
  // - accepted with a payment_intent_id (Pay & Start Job clicked, escrow hold created)
  const hasPaymentHold =
    typeof j.payment_intent_id === "string" && !!j.payment_intent_id?.trim();

  const status = j.status ?? "";
  const chatAllowed =
    status === "in_progress" ||
    status === "completed" ||
    (status === "accepted" && hasPaymentHold);

  if (!chatAllowed) {
    return {
      ok: false,
      error: "Chat will open once the lister has started the job (after Pay & Start Job).",
    };
  }

  const row: JobMessageInsert = {
    job_id: jobId,
    sender_id: session.user.id,
    message_text: text,
  };

  const { error } = await supabase
    .from("job_messages")
    .insert(row as never);

  if (error) {
    return { ok: false, error: error.message };
  }

  // Fire a notification for the recipient (other party on the job).
  const recipientId =
    session.user.id === j.lister_id ? j.winner_id : j.lister_id;
  if (recipientId) {
    const preview = text.length > 100 ? `${text.slice(0, 97)}...` : text;
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .maybeSingle();
    const senderName = (senderProfile as { full_name?: string | null } | null)?.full_name ?? undefined;
    await createNotification(
      recipientId,
      "new_message",
      jobId,
      preview,
      { senderName: senderName ?? undefined }
    );
  }

  return { ok: true };
}

