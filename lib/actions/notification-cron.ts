"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { createNotification } from "@/lib/actions/notifications";
import { hasRecentJobNotification } from "@/lib/notifications/notification-dedupe";

/**
 * Warn listers ~24h before auto-release. Schedule with CRON (e.g. hourly) alongside auto-release.
 */
export async function processAutoReleaseWarnings(): Promise<{ notified: number }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { notified: 0 };

  const settings = await getGlobalSettings();
  if (settings?.manual_payout_mode) return { notified: 0 };

  const { data: jobs, error } = await admin
    .from("jobs")
    .select("id, lister_id, auto_release_at, auto_release_at_original")
    .eq("status", "completed_pending_approval")
    .eq("cleaner_confirmed_complete", true)
    .is("payment_released_at", null);

  if (error || !jobs?.length) return { notified: 0 };

  let notified = 0;
  const now = Date.now();

  for (const j of jobs as {
    id: number;
    lister_id: string;
    auto_release_at?: string | null;
    auto_release_at_original?: string | null;
  }[]) {
    const atIso = j.auto_release_at ?? j.auto_release_at_original;
    if (!atIso) continue;
    const releaseMs = new Date(atIso).getTime();
    const remainingMs = releaseMs - now;
    const hoursLeft = remainingMs / (3600 * 1000);
    if (hoursLeft > 24 || hoursLeft <= 22.5) continue;
    if (await hasRecentJobNotification(j.lister_id, "auto_release_warning", j.id, 48)) continue;
    await createNotification(
      j.lister_id,
      "auto_release_warning",
      j.id,
      "About 24 hours left to review this job before payment auto-releases to the cleaner."
    );
    notified++;
  }

  return { notified };
}
