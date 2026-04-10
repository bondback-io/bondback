import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { JOB_DETAIL_PAGE_SELECT } from "@/lib/supabase/queries";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

/** Matches `createServerSupabaseClient()` return type (avoids SupabaseClient generic mismatch). */
export type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function sameUserId(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/**
 * Load a job by numeric PK for `/jobs/[id]`. Uses the user-scoped client first; if no row is
 * returned (common when RLS allows cleaners but not listers to read `jobs`), falls back to the
 * service role and returns the row only when `sessionUserId` is `lister_id` or `winner_id`.
 */
export async function loadJobByNumericIdForSession(
  supabase: ServerSupabaseClient,
  jobId: number,
  sessionUserId: string | undefined
): Promise<JobRow | null> {
  const { data: fromUser, error } = await supabase
    .from("jobs")
    .select(JOB_DETAIL_PAGE_SELECT)
    .eq("id", jobId)
    .maybeSingle();

  if (!error && fromUser) {
    return fromUser as JobRow;
  }

  const admin = createSupabaseAdminClient();
  if (!admin || !sessionUserId?.trim()) {
    return null;
  }

  const { data: full } = await admin
    .from("jobs")
    .select(JOB_DETAIL_PAGE_SELECT)
    .eq("id", jobId)
    .maybeSingle();

  if (!full) {
    return null;
  }

  const j = full as JobRow;
  if (sameUserId(j.lister_id, sessionUserId) || sameUserId(j.winner_id, sessionUserId)) {
    return j;
  }

  return null;
}
