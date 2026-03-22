/**
 * Server-side MIME detection from file content (magic bytes).
 * Use to re-validate uploads regardless of client-reported type.
 */

export const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

/** JPEG: FF D8 FF */
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);
/** PNG: 89 50 4E 47 0D 0A 1A 0A */
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** WebP: RIFF (0-3) ... WEBP (8-11) */
const WEBP_RIFF = Buffer.from([0x52, 0x49, 0x46, 0x46]);
const WEBP_WEBP = Buffer.from([0x57, 0x45, 0x42, 0x50]);

/**
 * Detect MIME from buffer using magic bytes.
 * Returns allowed MIME or null if not a supported image.
 */
export function getMimeFromMagic(buffer: Buffer): AllowedImageMime | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 3).equals(JPEG_SIG)) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIG)) return "image/png";
  if (
    buffer.subarray(0, 4).equals(WEBP_RIFF) &&
    buffer.length >= 12 &&
    buffer.subarray(8, 12).equals(WEBP_WEBP)
  )
    return "image/webp";
  return null;
}

/**
 * Re-validate that the buffer is an allowed image type by content.
 * Returns { valid: true, mime } or { valid: false, error }.
 */
export function validateImageBuffer(
  buffer: Buffer
): { valid: true; mime: AllowedImageMime } | { valid: false; error: string } {
  const mime = getMimeFromMagic(buffer);
  if (!mime) {
    return { valid: false, error: "Invalid image (only JPG, PNG, or WebP allowed)" };
  }
  return { valid: true, mime };
}
