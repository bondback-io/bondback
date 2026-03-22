/**
 * Server-side image processing with sharp.
 * - EXIF orientation applied via .rotate(); output does not keep input metadata (privacy).
 * - Resize to max 1920×1920, 80% quality (bandwidth/storage).
 * - Generate 200×200 thumbnail for previews.
 * Use only in server actions or API routes.
 */

import sharp from "sharp";

const MAX_EDGE = 1920;
const QUALITY = 80;
const THUMB_SIZE = 200;

export type ProcessedImage = {
  main: Buffer;
  thumb: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

/**
 * Process image: strip EXIF/metadata, resize to max 1920×1920 at 80% quality, generate 200×200 thumb.
 * Input buffer must be validated (magic bytes) before calling.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const meta = await sharp(input, { failOnError: true }).metadata();
  const format = meta.format as "jpeg" | "png" | "webp" | undefined;
  const contentType =
    format === "png"
      ? "image/png"
      : format === "webp"
        ? "image/webp"
        : "image/jpeg";

  const outputOptions =
    format === "png"
      ? { compressionLevel: 6 }
      : { quality: QUALITY };

  // rotate() applies EXIF orientation; metadata is omitted by default in output (no keepMetadata())
  const main = await sharp(input, { failOnError: true })
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    [format === "png" ? "png" : format === "webp" ? "webp" : "jpeg"](outputOptions)
    .toBuffer();

  const thumb = await sharp(input, { failOnError: true })
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
    [format === "png" ? "png" : format === "webp" ? "webp" : "jpeg"]({ quality: 80 })
    .toBuffer();

  return {
    main,
    thumb,
    contentType: contentType as ProcessedImage["contentType"],
  };
}
