import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Count non-thumb images in `jobs/{jobId}/after` (service role). */
export async function countJobAfterPhotosFromStorage(jobId: number): Promise<number> {
  const admin = createSupabaseAdminClient();
  if (!admin) return 0;
  const { data, error } = await admin.storage
    .from("condition-photos")
    .list(`jobs/${jobId}/after`, { limit: 100 });
  if (error || !data) return 0;
  return data.filter((f) => f.name && !String(f.name).startsWith("thumb_")).length;
}
