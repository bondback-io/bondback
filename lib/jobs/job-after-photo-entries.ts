import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type JobAfterPhotoEntry = { name: string; url: string };

/**
 * Lists `condition-photos` objects under `jobs/{jobId}/after` using the service role.
 * Browser clients may lack storage.objects SELECT for this prefix (cleaner can upload; lister must still review).
 */
export async function listJobAfterPhotoEntries(
  jobId: number
): Promise<JobAfterPhotoEntry[]> {
  const admin = createSupabaseAdminClient();
  if (!admin || !Number.isFinite(jobId) || jobId < 1) return [];

  const folder = `jobs/${jobId}/after`;
  const { data, error } = await admin.storage
    .from("condition-photos")
    .list(folder, { limit: 100 });

  if (error || !data) return [];

  return data
    .filter((file) => file.name && !file.name.startsWith("thumb_"))
    .map((file) => {
      const path = `${folder}/${file.name}`;
      const {
        data: { publicUrl },
      } = admin.storage.from("condition-photos").getPublicUrl(path);
      return { name: file.name, url: publicUrl };
    });
}
