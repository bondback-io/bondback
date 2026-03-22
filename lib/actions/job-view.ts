"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Call when the user views a job page. Updates last_job_view so we can skip
 * "new message" emails when the recipient is currently viewing the job.
 */
export async function recordJobView(jobId: number | string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const id = typeof jobId === "string" ? parseInt(jobId, 10) : jobId;
  if (Number.isNaN(id)) return;

  await (supabase as any)
    .from("last_job_view")
    .upsert(
      { user_id: session.user.id, job_id: id, viewed_at: new Date().toISOString() },
      { onConflict: ["user_id", "job_id"] }
    );
}
