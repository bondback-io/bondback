/**
 * Shared photo upload validation for Bond Back.
 * Client-side: MIME (file.type), suspicious names, size 0, and optional magic-byte header check.
 * Server re-validates via magic bytes and processes (strip EXIF, resize) in upload-photos action.
 */

export const PHOTO_VALIDATION = {
  /** Allowed MIME types; validated via file.type (not extension-only). Server re-checks via magic bytes. */
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/webp"] as const,
  /** Max file size in bytes (5 MB) */
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  /** Human-readable max size */
  MAX_FILE_LABEL: "5 MB",
  /** Accept attribute for file input */
  ACCEPT: "image/jpeg,image/png,image/webp",
} as const;

/** Max number of photos per context */
export const PHOTO_LIMITS = {
  /** Minimum initial condition photos required to publish (users may continue the wizard with fewer). */
  LISTING_INITIAL_MIN_PUBLISH: 3,
  LISTING_INITIAL: 15,
  JOB_AFTER: 12,
  PORTFOLIO: 12,
  PROFILE: 1,
  REVIEW: 5,
  LISTING_EDIT: 8,
  DISPUTE: 5,
} as const;

/** Extensions that are never allowed (even if disguised) */
const SUSPICIOUS_EXTENSIONS = /\.(php|phtml|php\d*|exe|bat|cmd|sh|bash|js|vbs|wsf|jse?)$/i;

/** Double-extension pattern: e.g. file.php.jpg or file.jpg.exe */
const DOUBLE_EXTENSION = /\.(jpe?g|png|webp)\.(php|phtml|exe|bat|sh|js)$/i;

/**
 * Reject files with suspicious names (e.g. .php, .exe disguised as .jpg).
 */
export function isSuspiciousFileName(name: string): boolean {
  const lower = name.toLowerCase();
  if (SUSPICIOUS_EXTENSIONS.test(lower)) return true;
  if (DOUBLE_EXTENSION.test(lower)) return true;
  return false;
}

export type PhotoLimitKey = keyof typeof PHOTO_LIMITS;

export type ValidateSingleResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validate a single file: MIME (file.type), size, suspicious name, empty/corrupted.
 * Returns { valid: true } or { valid: false, error: "..." }.
 */
export function validatePhotoFile(file: File): ValidateSingleResult {
  const allowed = [...PHOTO_VALIDATION.ALLOWED_TYPES];
  const mimeOk = allowed.includes(file.type as (typeof allowed)[number]);
  if (!mimeOk) {
    return { valid: false, error: "Only JPG, PNG, or WebP allowed" };
  }
  if (isSuspiciousFileName(file.name)) {
    return { valid: false, error: "Invalid or unsafe file name" };
  }
  if (file.size === 0) {
    return { valid: false, error: "File is empty or corrupted" };
  }
  if (file.size > PHOTO_VALIDATION.MAX_FILE_BYTES) {
    return {
      valid: false,
      error: `File too large (max ${PHOTO_VALIDATION.MAX_FILE_LABEL})`,
    };
  }
  return { valid: true };
}

export type ValidateManyResult = {
  valid: boolean;
  validFiles: File[];
  errors: string[];
};

/**
 * Validate multiple files and apply max/min count.
 * Returns validFiles (only those passing type/size) and errors (user-friendly messages for toast/inline).
 */
export function validatePhotoFiles(
  files: File[],
  options: {
    maxFiles: number;
    minFiles?: number;
    existingCount?: number;
  }
): ValidateManyResult {
  const { maxFiles, minFiles = 0, existingCount = 0 } = options;
  const validFiles: File[] = [];
  const errors: string[] = [];

  const totalAfter = existingCount + files.length;
  if (totalAfter > maxFiles) {
    errors.push(`Too many photos (max ${maxFiles} allowed)`);
  }

  for (const file of files) {
    const result = validatePhotoFile(file);
    if (result.valid) {
      validFiles.push(file);
    } else {
      if (!errors.includes(result.error)) {
        errors.push(result.error);
      }
    }
  }

  const totalValid = existingCount + validFiles.length;
  if (totalValid > maxFiles) {
    // Trim to max
    const toAdd = maxFiles - existingCount;
    validFiles.splice(toAdd);
  }

  if (minFiles > 0 && totalValid < minFiles && validFiles.length === files.length) {
    errors.push(`Please select at least ${minFiles} photo${minFiles === 1 ? "" : "s"} (recommended)`);
  }

  return {
    valid: errors.length === 0 && validFiles.length > 0,
    validFiles,
    errors,
  };
}

/**
 * Validate a single file for profile photo (max 1, type + size).
 */
export function validateProfilePhoto(file: File): ValidateSingleResult {
  const result = validatePhotoFile(file);
  if (!result.valid) return result;
  return { valid: true };
}

/** JPEG magic: FF D8 FF */
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff]);
/** PNG magic: 89 50 4E 47 0D 0A 1A 0A */
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** WebP: RIFF....WEBP (bytes 0-3 RIFF, 8-11 WEBP) */
function isWebPHeader(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 12) return false;
  const v = new Uint8Array(buf);
  return (
    v[0] === 0x52 && v[1] === 0x49 && v[2] === 0x46 && v[3] === 0x46 &&
    v[8] === 0x57 && v[9] === 0x45 && v[10] === 0x42 && v[11] === 0x50
  );
}

/**
 * Check image header (magic bytes). Use to warn or reject corrupted/non-image files.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function checkImageHeader(file: File): Promise<{ valid: true } | { valid: false; error: string }> {
  return new Promise((resolve) => {
    const blob = file.slice(0, 12);
    const fr = new FileReader();
    fr.onload = () => {
      const buf = fr.result as ArrayBuffer | null;
      if (!buf || buf.byteLength === 0) {
        resolve({ valid: false, error: "File may be corrupted (invalid image)" });
        return;
      }
      const v = new Uint8Array(buf);
      const jpegOk = buf.byteLength >= 3 && v[0] === JPEG_MAGIC[0] && v[1] === JPEG_MAGIC[1] && v[2] === JPEG_MAGIC[2];
      const pngOk = buf.byteLength >= 8 && PNG_MAGIC.every((b, i) => v[i] === b);
      const webpOk = isWebPHeader(buf);
      if (jpegOk || pngOk || webpOk) resolve({ valid: true });
      else resolve({ valid: false, error: "File may be corrupted (invalid image)" });
    };
    fr.onerror = () => resolve({ valid: false, error: "Could not read file" });
    fr.readAsArrayBuffer(blob);
  });
}
