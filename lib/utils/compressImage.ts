/**
 * Client-side image compression before server actions / storage upload.
 * Targets mobile-friendly payloads: max width, JPEG quality, hard byte ceiling.
 */

export const COMPRESS_MAX_WIDTH_PX = 1200;
export const COMPRESS_JPEG_QUALITY = 0.75;
/** Target max output size (~1.5 MB); we reduce quality / dimensions if needed */
export const COMPRESS_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);

export type CompressImageOptions = {
  maxWidthPx?: number;
  /** Initial JPEG quality 0–1 */
  quality?: number;
  maxBytes?: number;
};

function fileBaseName(name: string): string {
  return name.replace(/\.[^/.]+$/, "") || "photo";
}

/**
 * Decode image, scale to max width (preserving aspect), encode as JPEG with adaptive quality
 * so the result stays under `maxBytes` when possible.
 */
export async function compressImage(
  file: File,
  options?: CompressImageOptions
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  const maxWidthPx = options?.maxWidthPx ?? COMPRESS_MAX_WIDTH_PX;
  const maxBytes = options?.maxBytes ?? COMPRESS_MAX_BYTES;
  let quality = options?.quality ?? COMPRESS_JPEG_QUALITY;

  try {
    const bitmap = await createImageBitmap(file);
    try {
      let { width: w, height: h } = bitmap;
      if (w <= 0 || h <= 0) return file;

      let targetW = Math.min(w, maxWidthPx);
      let targetH = Math.round((h * targetW) / w);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;

      const drawAndEncode = async (): Promise<Blob | null> => {
        canvas.width = targetW;
        canvas.height = targetH;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, targetW, targetH);
        return new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
        });
      };

      let blob: Blob | null = await drawAndEncode();
      if (!blob || blob.size === 0) return file;

      // Reduce JPEG quality until under cap or floor
      while (blob.size > maxBytes && quality > 0.45) {
        quality = Math.round((quality - 0.05) * 100) / 100;
        blob = await drawAndEncode();
        if (!blob) return file;
      }

      // Still too large: shrink dimensions (mobile-friendly, avoids huge canvases)
      let guard = 0;
      while (blob.size > maxBytes && targetW > 480 && guard < 12) {
        guard += 1;
        targetW = Math.round(targetW * 0.88);
        targetH = Math.round((h * targetW) / w);
        blob = await drawAndEncode();
        if (!blob) return file;
      }

      if (!blob || blob.size === 0) return file;

      const base = fileBaseName(file.name);
      return new File([blob], `${base}-upload.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

/** User-facing message when server rejects payload or network fails */
export function formatPhotoUploadError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Upload failed. Please try again.";
  if (/body exceeded|413|payload too large/i.test(raw)) {
    return "The photo is still too large to send. Try another image or take a new photo.";
  }
  return raw;
}
