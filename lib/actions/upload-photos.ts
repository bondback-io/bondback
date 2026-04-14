"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateImageBuffer } from "@/lib/photo-magic-bytes";
import { processImage } from "@/lib/photo-process";
import { PHOTO_VALIDATION } from "@/lib/photo-validation";

export type UploadPhotoResult = {
  fileName: string;
  path?: string;
  url?: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  error?: string;
};

export type UploadPhotosOptions = {
  bucket: string;
  pathPrefix: string;
  maxFiles?: number;
  /** Current number of photos already stored for this resource; server enforces existingCount + files.length <= maxFiles. */
  existingCount?: number;
  /** If true, upload thumbnail to pathPrefix/thumb_<name>. Default true. */
  generateThumb?: boolean;
};

/**
 * Process and upload one or more photos:
 * - Re-validate MIME via magic bytes (not client-reported type).
 * - Strip EXIF (privacy), resize/compress (max 1920×1920, 80% quality), thumbnail (200×200).
 * Returns one result per file: path, url, thumbnailUrl, or error (e.g. "Invalid image (only JPG, PNG, or WebP allowed)").
 */
export async function uploadProcessedPhotos(
  formData: FormData,
  options: UploadPhotosOptions
): Promise<{ ok: boolean; results: UploadPhotoResult[]; error?: string }> {
  const { bucket, pathPrefix, maxFiles = 10, existingCount = 0, generateThumb = true } = options;
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, results: [], error: "You must be logged in." };
  }

  const rawFiles = formData.getAll("files") as File[];
  const single = formData.get("file") as File | null;
  const files: File[] = rawFiles.length ? rawFiles : single ? [single] : [];
  if (files.length === 0) {
    return { ok: false, results: [], error: "No files provided." };
  }
  if (files.length > maxFiles) {
    return {
      ok: false,
      results: files.map((f) => ({ fileName: f.name, error: "Too many files" })),
      error: `Max ${maxFiles} files allowed.`,
    };
  }
  const totalAfter = existingCount + files.length;
  if (totalAfter > maxFiles) {
    return {
      ok: false,
      results: files.map((f) => ({ fileName: f.name, error: "Too many photos for this resource" })),
      error: `Too many photos (max ${maxFiles} allowed). You have ${existingCount} and tried to add ${files.length}.`,
    };
  }

  const uid = session.user.id;
  const isProfilePhotosBucket = bucket === "profile-photos";
  if (isProfilePhotosBucket) {
    if (pathPrefix !== uid && !pathPrefix.startsWith(`${uid}/`)) {
      return {
        ok: false,
        results: files.map((f) => ({ fileName: f.name, error: "Invalid upload path" })),
        error: "Invalid upload path.",
      };
    }
  }

  const admin = createSupabaseAdminClient();
  const storageClient = isProfilePhotosBucket && admin ? admin : supabase;

  const results: UploadPhotoResult[] = [];

  for (const file of files) {
    const fileName = file.name || `photo-${Date.now()}.jpg`;
    try {
      if (file.size === 0 || file.size > PHOTO_VALIDATION.MAX_FILE_BYTES) {
        results.push({
          fileName,
          error:
            file.size === 0
              ? "rejected — file is empty or corrupted"
              : `rejected — file too large (max ${PHOTO_VALIDATION.MAX_FILE_LABEL})`,
        });
        continue;
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const validation = validateImageBuffer(buffer);
      if (!validation.valid) {
        results.push({ fileName, error: `rejected — ${validation.error}` });
        continue;
      }

      const { main, thumb, contentType } = await processImage(buffer);
      const ext =
        validation.mime === "image/jpeg"
          ? "jpg"
          : validation.mime === "image/png"
            ? "png"
            : "webp";
      const baseName = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const mainPath = `${pathPrefix}/${baseName}.${ext}`;
      const thumbPath = `${pathPrefix}/thumb_${baseName}.${ext}`;

      const { error: mainError } = await storageClient.storage
        .from(bucket)
        .upload(mainPath, main, { contentType, upsert: true });

      if (mainError) {
        results.push({
          fileName,
          error: `rejected — ${mainError.message ?? "upload failed"}`,
        });
        continue;
      }

      if (generateThumb) {
        const { error: thumbErr } = await storageClient.storage
          .from(bucket)
          .upload(thumbPath, thumb, { contentType, upsert: true });
        if (thumbErr) {
          results.push({
            fileName,
            error: `rejected — thumbnail upload failed (${thumbErr.message ?? "unknown"})`,
          });
          await storageClient.storage.from(bucket).remove([mainPath]);
          continue;
        }
      }

      const {
        data: { publicUrl: mainUrl },
      } = storageClient.storage.from(bucket).getPublicUrl(mainPath);
      let thumbnailUrl: string | undefined;
      if (generateThumb) {
        const { data: thumbData } = storageClient.storage
          .from(bucket)
          .getPublicUrl(thumbPath);
        thumbnailUrl = thumbData.publicUrl;
      }

      results.push({
        fileName,
        path: mainPath,
        url: mainUrl,
        thumbnailPath: generateThumb ? thumbPath : undefined,
        thumbnailUrl,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "rejected — invalid image";
      results.push({ fileName, error: message });
    }
  }

  const hasSuccess = results.some((r) => r.url);
  return { ok: hasSuccess, results };
}
