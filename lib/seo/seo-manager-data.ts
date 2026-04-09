import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runSeoAutoChecks } from "@/lib/seo/seo-auto-checks";
import type { SeoAutoCheckResults } from "@/lib/seo/seo-auto-checks";

type ManualMap = Record<string, { completed_at: string | null; notes: string | null }>;

type Row = {
  task_key: string;
  completed_at: string | null;
  notes: string | null;
};

/**
 * Loads auto-check results + manual checklist rows for Admin SEO Manager.
 * Route is already protected by `app/admin/layout.tsx` (is_admin).
 */
export async function loadSeoManagerData(): Promise<{
  auto: SeoAutoCheckResults;
  manual: ManualMap;
}> {
  const auto = runSeoAutoChecks();
  const manual: ManualMap = {};

  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("seo_manual_checklist")
      .select("task_key, completed_at, notes");
    if (error) {
      console.warn("[seo-manager-data] seo_manual_checklist:", error.message);
    } else if (data) {
      for (const row of data as Row[]) {
        manual[row.task_key] = {
          completed_at: row.completed_at,
          notes: row.notes,
        };
      }
    }
  }

  return { auto, manual };
}
