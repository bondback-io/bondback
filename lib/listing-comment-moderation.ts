/** Basic patterns: phone-like sequences, URLs, common abusive terms (replace, not block). */

const PHONE_LIKE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,6}\b/g;

const URL_LIKE =
  /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9-]{1,40}\.(?:com|au|net|org|io|co|app|me)\b/gi;

/** Small inoffensive placeholder set — extend server-side if needed. */
const PROFANITY = [
  /\b(f+u+c+k+|f+ck)\b/gi,
  /\b(s+h+i+t+|sh1t)\b/gi,
  /\b(b+i+t+c+h+)\b/gi,
  /\b(c+u+n+t+)\b/gi,
  /\b(a+s+s+h+o+l+e+)\b/gi,
  /\b(d+i+c+k+)\b/gi,
];

const MAX_LEN = 2000;

export type ModerateListingCommentResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/**
 * Normalise user input: strip leading/trailing space, cap length, redact phones/URLs/profanity.
 */
export function moderateListingCommentText(raw: string): ModerateListingCommentResult {
  let t = (raw ?? "").trim().replace(/\s+/g, " ");
  if (t.length === 0) {
    return { ok: false, error: "Write something before posting." };
  }
  if (t.length > MAX_LEN) {
    return { ok: false, error: `Keep it under ${MAX_LEN} characters.` };
  }
  t = t.replace(PHONE_LIKE, "[removed]");
  t = t.replace(URL_LIKE, "[link removed]");
  for (const re of PROFANITY) {
    t = t.replace(re, "***");
  }
  t = t.trim();
  if (t.length === 0) {
    return { ok: false, error: "That message cannot be posted after moderation." };
  }
  return { ok: true, text: t };
}
