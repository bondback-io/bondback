import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Returns true if the user already has a notification of this type for this job
 * within the lookback window (dedupe for cron / client re-fires).
 */
export async function hasRecentJobNotification(
  userId: string,
  type: string,
  jobId: number,
  withinHours: number
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type as never)
    .eq("job_id", jobId as never)
    .gte("created_at", since)
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/** Dedupe in-app "new job in area" per listing per cleaner (e.g. SMS+push retries). */
export async function hasRecentNewJobInAreaNotification(
  userId: string,
  listingId: string,
  withinHours: number
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("notifications")
    .select("data")
    .eq("user_id", userId)
    .eq("type", "new_job_in_area" as never)
    .gte("created_at", since);
  if (error) return false;
  const rows = (data ?? []) as { data: Record<string, unknown> | null }[];
  return rows.some(
    (r) =>
      (r.data as { listing_uuid?: string } | null)?.listing_uuid === listingId
  );
}
