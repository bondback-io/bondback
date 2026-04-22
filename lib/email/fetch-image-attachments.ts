/**
 * Download public image URLs for Resend email attachments (Buffers).
 */

export type EmailAttachmentBuffer = { filename: string; content: Buffer };

const MAX_ATTACHMENTS = 5;
const MAX_BYTES_PER_FILE = 8 * 1024 * 1024;
const MIN_BYTES = 32;
const FETCH_TIMEOUT_MS = 25_000;

function extensionFromContentType(ct: string): string {
  const c = ct.toLowerCase();
  if (c.includes("png")) return "png";
  if (c.includes("webp")) return "webp";
  if (c.includes("jpeg") || c.includes("jpg")) return "jpg";
  return "jpg";
}

function extensionFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.endsWith(".png")) return "png";
    if (path.endsWith(".webp")) return "webp";
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "jpg";
  } catch {
    /* invalid URL */
  }
  return "jpg";
}

function contentTypeLooksLikeImage(ct: string | null): boolean {
  if (!ct) return true;
  const c = ct.toLowerCase();
  return c.startsWith("image/") || c.includes("octet-stream");
}

/**
 * Fetches up to five URLs and returns buffers suitable for Resend `attachments`.
 * Failures per URL are skipped (partial attachments are OK).
 */
export async function fetchImageAttachmentsForEmail(
  urls: string[],
  filenamePrefix: string
): Promise<EmailAttachmentBuffer[]> {
  const out: EmailAttachmentBuffer[] = [];
  const slice = urls.slice(0, MAX_ATTACHMENTS);

  for (let i = 0; i < slice.length; i++) {
    const url = String(slice[i] ?? "").trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) continue;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);

      if (!res.ok) continue;

      const ct = res.headers.get("content-type");
      if (!contentTypeLooksLikeImage(ct)) continue;

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < MIN_BYTES || buf.length > MAX_BYTES_PER_FILE) continue;

      const ext = ct?.startsWith("image/")
        ? extensionFromContentType(ct)
        : extensionFromUrl(url);
      const safePrefix = filenamePrefix.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
      out.push({
        filename: `${safePrefix}-${i + 1}.${ext}`,
        content: buf,
      });
    } catch {
      /* network / abort — skip this URL */
    }
  }

  return out;
}
