/**
 * Client-side resize before upload — reduces bytes on mobile networks and Supabase storage.
 * Server actions still run magic-byte validation and sharp processing.
 */

export const CLIENT_UPLOAD_MAX_WIDTH = 1200;

/**
 * Downscale image to max width (preserving aspect). PNG stays PNG; JPEG/WebP become JPEG for smaller uploads.
 * On failure or tiny images, returns the original file unchanged.
 */
export async function resizeImageFileForUpload(
  file: File,
  maxWidth: number = CLIENT_UPLOAD_MAX_WIDTH
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const { width, height } = bitmap;
      if (width <= 0 || height <= 0) return file;
      if (width <= maxWidth) return file;

      const scale = maxWidth / width;
      const w = Math.round(maxWidth);
      const h = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, w, h);

      const usePng = file.type === "image/png";
      const mime: "image/png" | "image/jpeg" = usePng ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b),
          mime,
          usePng ? undefined : 0.85
        );
      });
      if (!blob || blob.size === 0) return file;

      const base = file.name.replace(/\.[^/.]+$/, "") || "photo";
      const ext = usePng ? "png" : "jpg";
      return new File([blob], `${base}-upload.${ext}`, {
        type: mime,
        lastModified: Date.now(),
      });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
